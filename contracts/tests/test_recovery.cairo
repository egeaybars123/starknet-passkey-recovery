use core::option::OptionTrait;
use core::traits::TryInto;
use snforge_std::signature::SignerTrait;
use starknet::{ContractAddress, contract_address_const, account::Call};

use snforge_std::{
    declare, ContractClassTrait, start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp, stop_cheat_block_timestamp, start_cheat_transaction_hash, stop_cheat_transaction_hash,
    start_cheat_signature, stop_cheat_signature,
};
use snforge_std::signature::KeyPairTrait;
use snforge_std::signature::stark_curve::{
    StarkCurveKeyPairImpl, StarkCurveSignerImpl, StarkCurveVerifierImpl
};

use passkey::account::IAccountDispatcher;
use passkey::account::IAccountSafeDispatcherTrait;
use passkey::account::IAccountSafeDispatcher;
use passkey::account::IAccountDispatcherTrait;
use passkey::account::{P256_PubKey};
use starknet::secp256_trait::{Secp256PointTrait, Signature, is_valid_signature};
use starknet::secp256r1::{Secp256r1Impl, Secp256r1Point, Secp256r1PointImpl};

fn deploy_account_contract(name: ByteArray, pub_key: felt252) -> ContractAddress {
    let contract = declare(name).unwrap();
    let constructor_args = array![pub_key];
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    contract_address
}

//snforge test tests::test_contract::test_stark_curve_sig --exact
#[test]
fn test_stark_curve_sig() {
    let public_key: felt252 = 0x295ae800856ef8bd7954ce34183a5ac1996692f55d47595b65e3466af2ffb21;
    let contract_address = deploy_account_contract("Account", public_key);
    let dispatcher = IAccountDispatcher { contract_address };
    let tx_hash = 0x6797752e8dc484fed344dbecbf39894022ae06e7cf929e49aaf056816b07d3c;
    let (r, s): (felt252, felt252) = (3617088214417922704410123782735126342227376231281757505369860748101734984678, 833205401165317959179622579712918199700452403838903712697118225050609154028);
    let signature = array![0, r, s]; //Note: 0 stands for Stark Curve (signature type for the account)
    let result = dispatcher.is_valid_signature(tx_hash, signature.clone());
    assert(result == 'VALID', 'Invalid Stark sig');  

    let mock_account_address = contract_address_const::<123456789>();
    let start_recovery_call = Call { to: contract_address, selector: selector!("start_recovery_phase"), calldata: array![mock_account_address.into()].span() };
    start_cheat_transaction_hash(contract_address, tx_hash);
    start_cheat_caller_address(contract_address, 0.try_into().unwrap());
    start_cheat_signature(contract_address, signature.span());
    dispatcher.__execute__(array![start_recovery_call]);
}

#[test]
fn test_recovery_sig() {
    let key_pair = KeyPairTrait::<felt252, felt252>::generate();
    let contract_address = deploy_account_contract("Account", key_pair.public_key);
    let dispatcher = IAccountDispatcher { contract_address: contract_address };
    start_cheat_caller_address(contract_address, contract_address);
    dispatcher.set_recovery_pub_key(P256_PubKey {
                pub_x: 114993217930386683611679002860422741687021570539436274732867184849660838463437,
                pub_y: 110487202272546357630011941974732669489767008677546000553892285274930450649259,
            });
    stop_cheat_caller_address(contract_address);
    
    let r: u256 = 49286468589410731259259119571501053955126051666910569130054053376099280272967;
    let s: u256 = 76559431138461715451997198697675977212666237506995452072255655489446637833763;

    //Index 0: 1 -> Secp256r1 Signature type
    //Last Index: 0 -> No extra data on webauthn signature
    let signature: Span<felt252> = array![1, r.low.into(), r.high.into(), s.low.into(), s.high.into(), 0].span(); 
    let tx_hash: felt252 = 0xcc3b37ed859e1a3d9ff28ba910382eba8fac02ac00449eba82449a02415b6e;
    let mock_account_address = contract_address_const::<123456789>();
    let start_recovery_call = Call { to: contract_address, selector: selector!("start_recovery_phase"), calldata: array![mock_account_address.into()].span() };
    
    start_cheat_transaction_hash(contract_address, tx_hash);
    start_cheat_caller_address(contract_address, 0.try_into().unwrap());
    start_cheat_signature(contract_address, signature);
    dispatcher.__execute__(array![start_recovery_call]);
    stop_cheat_transaction_hash(contract_address);
    stop_cheat_caller_address(contract_address);
    stop_cheat_signature(contract_address);
    
}

#[test]
fn test_start_recovery() {
    let key_pair = KeyPairTrait::<felt252, felt252>::generate();
    let contract_address = deploy_account_contract("Account", key_pair.public_key);
    let dispatcher = IAccountDispatcher { contract_address: contract_address };
    start_cheat_caller_address(contract_address, contract_address);
    dispatcher.set_recovery_pub_key(P256_PubKey {
                pub_x: 114993217930386683611679002860422741687021570539436274732867184849660838463437,
                pub_y: 110487202272546357630011941974732669489767008677546000553892285274930450649259,
            });
   
    let mock_account_address = contract_address_const::<123456789>();
    start_cheat_caller_address(contract_address, contract_address);
    dispatcher.start_recovery_phase(mock_account_address);
    stop_cheat_caller_address(contract_address);

    let result = dispatcher.get_in_recovery_phase();
    assert!(result, "Signature not true");
}


#[test]
fn test_complete_recovery() {
    let public_key: felt252 = 999;
    let contract_address = deploy_account_contract("Account", public_key);
    let recovery_timestamp = 30; //hardcoded in the contract

    let dispatcher = IAccountDispatcher { contract_address };
    start_cheat_caller_address(contract_address, contract_address);
    dispatcher
        .set_recovery_pub_key(
            P256_PubKey {
                pub_x: 114993217930386683611679002860422741687021570539436274732867184849660838463437,
                pub_y: 110487202272546357630011941974732669489767008677546000553892285274930450649259,
            }
        );
    stop_cheat_caller_address(contract_address);
    
    let mock_account_address = contract_address_const::<123456789>();

    start_cheat_block_timestamp(contract_address, 1000);
    start_cheat_caller_address(contract_address, contract_address);
    dispatcher.start_recovery_phase(mock_account_address);
    stop_cheat_caller_address(contract_address);
    stop_cheat_block_timestamp(contract_address);
    let result = dispatcher.get_in_recovery_phase();
    assert!(result, "Signature not true");

    let new_public_key: felt252 = 1500;
    start_cheat_block_timestamp(contract_address, 1000 + recovery_timestamp + 1);
    start_cheat_caller_address(contract_address, mock_account_address);
    dispatcher.complete_recovery(new_public_key);
    assert!(dispatcher.get_in_recovery_phase() == false, "Recovery phase true");
    assert!(dispatcher.public_key() == new_public_key, "Pub_key not set");
}
