"use client";
import { registerPasskey } from "../app/passkey/register";
import { useState, useMemo, useEffect } from "react";
import { WebAuthnSigner } from "@/app/passkey/webauthn_signer";
import { StarkSigner } from "@/app/passkey/stark_signer";
import abi from "../app/starknet/account_abi.json";
import { Account, cairo, Contract, num, RpcProvider } from "starknet";

export default function Passkey() {
    const [accountAddress, setAccountAddress] = useState('');
    const [accountContract, setAccountContract] = useState('');
    const [accountRecoveryContract, setAccountRecoveryContract] = useState('');
    const [recovererAddress, setRecovererAddress] = useState('');
    const [recovererPubKey, setRecovererPubKey] = useState('');
    const [recoveryPubKey, setRecoveryPubKey] = useState('');

    // **********     Registration Contract Interactions     **********
    useEffect(() => {
        if (accountAddress) {
            const provider = new RpcProvider({ nodeUrl: 'https://free-rpc.nethermind.io/sepolia-juno' });
            const signer = new WebAuthnSigner(new Uint8Array([1]))
            const recovery_account = new Account(provider, accountAddress, signer, "1")
            const recovery_contract = new Contract(abi.abi, accountAddress, recovery_account)

            const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY
            const stark_signer = new StarkSigner(privateKey)
            const stark_account = new Account(provider, accountAddress, stark_signer, "1")
            const contract = new Contract(abi.abi, accountAddress, stark_account)

            setAccountRecoveryContract(recovery_contract)
            setAccountContract(contract)
        }
        
    }, [accountAddress])

    useEffect(() => {
        if (accountContract) {
            async function getPubKey() {
                try {
                    const result = await accountContract.get_recovery_key();
                    setRecoveryPubKey(result)
                } catch (err) {
                    throw new Error("Invalid account address")
                }
            }
            getPubKey();
        }
        
    }, [accountContract])


    const handleRegistration = async (contractAddress) => {
        if (accountContract) {
            const result = await registerPasskey(contractAddress);
            const provider = new RpcProvider({ nodeUrl: 'https://free-rpc.nethermind.io/sepolia-juno' });
            const call = accountContract.populate('set_recovery_pub_key',
                [{ pub_x: cairo.uint256(result.x), pub_y: cairo.uint256(result.y) }]);
            const tx = await accountContract.set_recovery_pub_key(call.calldata)
            console.log("Recovery Passkey being Added!")
            await provider.waitForTransaction(tx.transaction_hash)
            console.log("Recovery Passkey Added!")
        }   
    }

    // **********     Recovery Contract Interactions     **********

    const handleRecovery = async () => {
        if (recovererAddress) {
            const provider = new RpcProvider({ nodeUrl: 'https://free-rpc.nethermind.io/sepolia-juno' });
            const call = accountRecoveryContract.populate('start_recovery_phase', [recovererAddress]);
            const tx = await accountRecoveryContract.start_recovery_phase(call.calldata)
            console.log("Recovery phase starting...")
            await provider.waitForTransaction(tx.transaction_hash)
            console.log("Recovery phase started!")
        }
    }
    
    return (
        <div className="mt-6 flex justify-center">
            <div className="bg-slate-100 shadow-xl justify-center rounded-lg p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Starknet Passkey Recovery Demo</h1>
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Enter your Starknet Account</h2>
                    <input type="text" onChange={(e) => setAccountAddress(e.target.value)} placeholder="Account Contract Address" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Set Passkey Recovery</h2>
                    <p className="text-gray-700 break-words">Click below if you want to set up a passkey recovery for the account you entered above: </p>
                    {recoveryPubKey
                        ?
                        <>
                            <p className="text-gray-700 mb-4 mt-4 break-words">Has recovery key?: {recoveryPubKey?.pub_x === 0n ? 'false' : 'true'}</p>
                            {recoveryPubKey?.pub_x !== 0n
                                ? <p className="text-gray-700 mb-4 mt-4 break-words">If you want to set up a different passkey for this account, click below: </p>
                                : <p></p>
                            } 
                        </>
                        : <p></p>
                    }
                    <button onClick={() => handleRegistration(accountAddress)} className="w-full bg-blue-500 text-white font-semibold py-2 rounded-lg hover:bg-blue-600 transition duration-300">Register Passkey</button>
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Recover Your Account</h2>
                    <p className="text-s text-gray-700 mb-4 break-words">Enter the contract address of the account which will recover your account: </p>
                    <input type="text" onChange={(e) => setRecovererAddress(e.target.value)} placeholder="Account Contract Address" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    <button onClick={handleRecovery} className="w-full bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-600 transition duration-300">Recover Account</button>
                </div>
            </div>
        </div>
    );
}

