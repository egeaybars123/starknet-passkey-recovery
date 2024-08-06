use starknet::account::Call;
use starknet::ContractAddress;
use starknet::secp256_trait::{Secp256PointTrait, Signature, is_valid_signature};
use starknet::secp256r1::{Secp256r1Impl, Secp256r1Point, Secp256r1PointImpl};

#[starknet::interface]
trait IAccount<T> {
    fn public_key(self: @T) -> felt252;
    fn set_recovery_pub_key(ref self: T, pub_key: P256_PubKey);
    fn start_recovery_phase(ref self: T, recoverer: ContractAddress);
    fn complete_recovery(ref self: T, pub_key: felt252);
    fn is_valid_signature(self: @T, hash: felt252, signature: Array<felt252>) -> felt252;
    fn __execute__(self: @T, calls: Array<Call>) -> Array<Span<felt252>>;
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

const START_RECOVERY_SELECTOR: felt252 = selector!("start_recovery_phase");

#[starknet::contract(account)]
mod Account {
    use super::{Call, IAccount, P256_PubKey};
    use starknet::{
        get_caller_address, call_contract_syscall, get_tx_info, ContractAddress, VALIDATED,
        get_block_timestamp, contract_address_const
    };
    use zeroable::Zeroable;
    use ecdsa::check_ecdsa_signature;

    //For testing purposes, set to 30 seconds. Ideal time could be 4 days maybe?
    const RECOVERY_TIME: u64 = 30;

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

        fn start_recovery_phase(ref self: ContractState, recoverer: ContractAddress) {
            assert!(self.in_recovery_phase.read() == false);
            self.in_recovery_phase.write(true);
            self.recovery_timestamp.write(get_block_timestamp());
            self.recoverer.write(recoverer);
        }

        fn complete_recovery(ref self: ContractState, pub_key: felt252) {
            let recovery_timestamp = self.recovery_timestamp.read();
            assert!(self.in_recovery_phase.read());
            assert!(get_block_timestamp() > recovery_timestamp + RECOVERY_TIME);
            assert!(self.recoverer.read() == get_caller_address());
            self.owner.write(get_caller_address());
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

        fn __execute__(self: @ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
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

        fn execute_single_call(self: @ContractState, call: Call) -> Span<felt252> {
            let Call { to, selector, calldata } = call;
            call_contract_syscall(to, selector, calldata).unwrap()
        }

        fn execute_multiple_calls(
            self: @ContractState, mut calls: Array<Call>
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
