"use client";
import { registerPasskey } from "../app/passkey/register";
import { loginCredentials } from "../app/passkey/login";
import { useState, useMemo } from "react";
import { useAccount, useContractRead, useContract, useContractWrite } from "@starknet-react/core";
import abi from "../app/starknet/account_abi.json";
import accountAddr from "../app/starknet/constants.json";
import { cairo, num } from "starknet";

export default function Passkey() {
    const [registerAddress, setRegisterAddress] = useState('');
    const [loginUsername, setLoginUsername] = useState('');
    const [registerResult, setRegisterResult] = useState();
    //const [extraData, setExtraData] = useState(false);
    //const [challenge, setChallenge] = useState()
    const { address, isConnected } = useAccount();

    const handleRegistration = async (contractAddress) => {
        const result = await registerPasskey(contractAddress);
        setRegisterResult(result)
        
        writeAsync()
    }

    const { contract } = useContract({
        abi: abi.abi,
        address: registerAddress,
    })

    const calls = useMemo(() => {
        console.log("Cairo x:", cairo.uint256(registerResult?.x))
        console.log("Cairo y:", cairo.uint256(registerResult?.y))
        return contract?.populateTransaction["set_recovery_pub_key"]({ pub_x: cairo.uint256(registerResult.x), pub_y: cairo.uint256(registerResult.y) })
    }, [registerResult])
        
        
    const {
        writeAsync,
        data,
        isPending,
    } = useContractWrite({
        calls,
    });

    const handleRecovery = async () => {
        const result = await loginCredentials();
        //setExtraData(result.extraData)
        //setChallenge(result)
        //handleContractCall(result)
        const uintArray = new Uint8Array(result.challenge)
        console.log("Challenge: ", Array.from(uintArray))
    }

    const ownerAbi = [{
        "name": "get_owner",
        "type": "function",
        "inputs": [],
        "outputs": [
            {
                "type": "core::felt252"
            }
        ],
        "state_mutability": "view"
    }]

    const { test } = useContractRead({
        functionName: "public_key",
        args: [],
        abi: abi.abi,
        address: accountAddr.recovery_account_contract,
        watch: true
    });

    const { data: walletPubKey } = useContractRead({
        functionName: "get_owner",
        args: [],
        abi: ownerAbi,
        address: address,
        watch: true,
    });

    

    return (
        <div className="mt-6 flex justify-center">
            <div className="bg-slate-100 shadow-xl justify-center rounded-lg p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Starknet Passkey Recovery Demo</h1>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Set Passkey Recovery</h2>
                    <input type="text" onChange={(e) => setRegisterAddress(e.target.value)} id="register-username" placeholder="Account Contract Address" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    <button onClick={()=>handleRegistration(address)} className="w-full bg-blue-500 text-white font-semibold py-2 rounded-lg hover:bg-blue-600 transition duration-300">Register Passkey</button>
                    <p id="register-status" className="text-sm text-gray-600 mt-2"></p>
                </div>

                <div suppressHydrationWarning>
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Recover Your Account</h2>
                    <p className="text-s text-gray-700 mb-4 break-words">Enter the contract address of the account to recover: </p>
                    <input type="text" onChange={(e) => setLoginUsername(e.target.value)} id="login-username" placeholder="Account Contract Address" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    {(isConnected)
                        ?
                        <>
                            <p className="text-s font-semibold text-gray-700 mb-4 break-words">Connected Wallet's Public Key:</p>
                            <p className="text-s text-gray-700 mb-4 break-words">{num?.toHex?.(walletPubKey ?? 0)}</p>
                            <p className="text-s text-gray-700 mb-4 break-words">This public key will be registered as the new owner of the account contract address you entered above</p>
                        </>
                        
                        : <p></p> 
                    }
                    <button onClick={handleRecovery} className="w-full bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-600 transition duration-300">Recover Account</button>
                </div>
            </div>
        </div>
    );
}

