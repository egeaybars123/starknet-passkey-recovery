use starknet::account::Call;
use starknet::ContractAddress;
use starknet::secp256_trait::{Secp256PointTrait, Signature, is_valid_signature};
use starknet::secp256r1::{Secp256r1Impl, Secp256r1Point, Secp256r1PointImpl};


#[starknet::interface]
trait IAccount<T> {
    fn public_key(self: @T) -> felt252;
    fn set_recovery_pub_key(ref self: T, pub_key: P256_PubKey);
    fn start_recovery_phase(ref self: T, recoverer: ContractAddress, challenge: Array<u8>, r: u256, s: u256, extra_data: bool);
    fn complete_recovery(ref self: T, pub_key: felt252);
    fn get_owner(self: @T) -> ContractAddress;
    fn is_valid_signature(self: @T, hash: felt252, signature: Array<felt252>) -> felt252;
    fn get_in_recovery_phase(self: @T) -> bool;
    fn __execute__(ref self: T, calls: Array<Call>) -> Array<Span<felt252>>;
    fn __validate__(self: @T, calls: Array<Call>) -> felt252;
    fn __validate_declare__(self: @T, class_hash: felt252) -> felt252;
    fn __validate_deploy__(
        self: @T, class_hash: felt252, salt: felt252, public_key: felt252
    ) -> felt252;
}

#[derive(Copy, Drop, Serde, starknet::Store)]
struct P256_PubKey {
    pub_x: u256,
    pub_y: u256
}

#[starknet::contract(account)]
mod Account {
    use core::array::ArrayTrait;
    use core::starknet::SyscallResultTrait;
    use core::result::ResultTrait;
    use super::{Call, IAccount, P256_PubKey};
    use starknet::{
        get_caller_address, call_contract_syscall, get_tx_info, ContractAddress, VALIDATED,
        get_block_timestamp, contract_address_const
    };
    use zeroable::Zeroable;
    use ecdsa::check_ecdsa_signature;
    use alexandria_math::{sha256::sha256};
    use alexandria_bytes::utils::{u8_array_to_u256};
    use starknet::secp256_trait::{Secp256PointTrait, Signature, is_valid_signature};
    use starknet::secp256r1::{Secp256r1Impl, Secp256r1Point, Secp256r1PointImpl};

    //For testing purposes, set to 30 seconds. Ideal time could be 4 days maybe?
    const RECOVERY_TIME: u64 = 30;
    const START_RECOVERY_SELECTOR: felt252 = selector!("test_recovery_phase");

    #[storage]
    struct Storage {
        public_key: felt252,
        recovery_pub_key: P256_PubKey,
        owner: ContractAddress,
        in_recovery_phase: bool,
        recoverer: ContractAddress,
        recovery_timestamp: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, public_key: felt252) {
        self.public_key.write(public_key);
        self.owner.write(get_caller_address());
    }

    #[abi(embed_v0)]
    impl AccountImpl of IAccount<ContractState> {
        fn set_recovery_pub_key(ref self: ContractState, pub_key: P256_PubKey) {
            let owner = self.owner.read();
            assert!(owner == get_caller_address());
            self.recovery_pub_key.write(pub_key);
        }

        fn get_in_recovery_phase(self: @ContractState) -> bool {
            self.in_recovery_phase.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
        
        fn start_recovery_phase(ref self: ContractState, recoverer: ContractAddress, challenge: Array<u8>, r: u256, s: u256, extra_data: bool) {
            assert!(self.in_recovery_phase.read() == false);
            let result = self.validate_webauthn_sig(challenge, r, s, extra_data);
            assert!(result, "Signature not true");
            self.in_recovery_phase.write(true);
            self.recovery_timestamp.write(get_block_timestamp());
            self.recoverer.write(recoverer);
        }

        fn complete_recovery(ref self: ContractState, pub_key: felt252) {
            let recovery_timestamp = self.recovery_timestamp.read();
            assert!(self.in_recovery_phase.read());
            assert!(get_block_timestamp() > recovery_timestamp + RECOVERY_TIME);
            assert!(self.recoverer.read() == get_caller_address());
            self.public_key.write(pub_key);
            self.in_recovery_phase.write(false);
            self.recoverer.write(contract_address_const::<0>());
        }

        fn public_key(self: @ContractState) -> felt252 {
            self.public_key.read()
        }

        fn is_valid_signature(
            self: @ContractState, hash: felt252, signature: Array<felt252>
        ) -> felt252 {
            let is_valid = self.is_valid_signature_bool(hash, signature.span());
            if is_valid {
                VALIDATED
            } else {
                0
            }
        }

        fn __execute__(ref self: ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
            assert(!calls.is_empty(), 'Account: No call data given');
            self.only_protocol();
            self.execute_multiple_calls(calls)
        }

        fn __validate__(self: @ContractState, calls: Array<Call>) -> felt252 {
            self.only_protocol();
            self.validate_transaction()
        }

        fn __validate_declare__(self: @ContractState, class_hash: felt252) -> felt252 {
            self.only_protocol();
            self.validate_transaction()
        }

        fn __validate_deploy__(
            self: @ContractState, class_hash: felt252, salt: felt252, public_key: felt252
        ) -> felt252 {
            self.only_protocol();
            self.validate_transaction()
        }
    }

    #[generate_trait]
    impl PrivateImpl of PrivateTrait {
        fn only_protocol(self: @ContractState) {
            let sender = get_caller_address();
            assert(sender.is_zero(), 'Account: invalid caller');
        }

        fn validate_webauthn_sig(self: @ContractState, challenge: Array<u8>, r: u256, s: u256, extra_data: bool) -> bool {
            let mut auth_data: Array<u8> = array![73,150,13,229,136,14,140,104,116,52,23,15,100,118,96,91,143,228,174,185,162,134,50,199,153,92,243,186,131,29,151,99,5,0,0,0,0];
            let mut first_part: Array<u8> = array![123,34,116,121,112,101,34,58,34,119,101,98,97,117,116,104,110,46,103,101,116,34,44,34,99,104,97,108,108,101,110,103,101,34,58,34];
            let second_part: Array<u8> = array![34,44,34,111,114,105,103,105,110,34,58,34,104,116,116,112,58,47,47,108,111,99,97,108,104,111,115,116,58,51,48,48,48,34,44,34,99,114,111,115,115,79,114,105,103,105,110,34,58,102,97,108,115,101,125];
            let second_part_extra_data: Array<u8> = array![34,44,34,111,114,105,103,105,110,34,58,34,104,116,116,112,58,47,47,108,111,99,97,108,104,111,115,116,58,51,48,48,48,34,44,34,99,114,111,115,115,79,114,105,103,105,110,34,58,102,97,108,115,101,44,34,111,116,104,101,114,95,107,101,121,115,95,99,97,110,95,98,101,95,97,100,100,101,100,95,104,101,114,101,34,58,34,100,111,32,110,111,116,32,99,111,109,112,97,114,101,32,99,108,105,101,110,116,68,97,116,97,74,83,79,78,32,97,103,97,105,110,115,116,32,97,32,116,101,109,112,108,97,116,101,46,32,83,101,101,32,104,116,116,112,115,58,47,47,103,111,111,46,103,108,47,121,97,98,80,101,120,34,125];

            first_part.append_span(challenge.span());
            if extra_data {
                first_part.append_span(second_part_extra_data.span());
            } else {
                first_part.append_span(second_part.span());
            }
            let client_hash: Array<u8> = sha256(first_part);
            auth_data.append_span(client_hash.span());
            let sig_hash: Array<u8> = sha256(auth_data);
            let sig_hash_u256: u256 = u8_array_to_u256(sig_hash.span());

            let pub_key = self.recovery_pub_key.read();
            let result: bool = is_valid_signature::<Secp256r1Point>(sig_hash_u256, r, s, 
                Secp256r1Impl::secp256_ec_new_syscall(pub_key.pub_x, pub_key.pub_y).unwrap_syscall().unwrap()); 

            result
        }

        fn is_valid_signature_bool(
            self: @ContractState, hash: felt252, signature: Span<felt252>
        ) -> bool {
            let is_valid_length = signature.len() == 2_u32;
            if !is_valid_length {
                return false;
            }
            check_ecdsa_signature(
                hash, self.public_key.read(), *signature.at(0_u32), *signature.at(1_u32)
            )
        }

        fn validate_transaction(self: @ContractState) -> felt252 {
            let tx_info = get_tx_info().unbox();
            let tx_hash = tx_info.transaction_hash;
            let signature = tx_info.signature;

            let is_valid = self.is_valid_signature_bool(tx_hash, signature);
            assert(is_valid, 'Account: Incorrect tx signature');
            VALIDATED
        }

        fn execute_single_call(ref self: ContractState, call: Call) -> Span<felt252> {
            let Call { to, selector, calldata } = call;
            call_contract_syscall(to, selector, calldata).unwrap()
        }

        fn execute_multiple_calls(
            ref self: ContractState, mut calls: Array<Call>
        ) -> Array<Span<felt252>> {
            let mut res = ArrayTrait::new();
            loop {
                match calls.pop_front() {
                    Option::Some(call) => {
                        let _res = self.execute_single_call(call);
                        res.append(_res);
                    },
                    Option::None(_) => { break (); },
                };
            };
            res
        }
    }
}
