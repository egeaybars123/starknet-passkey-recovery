"use client";
import { registerPasskey } from "../app/passkey/register";
import { loginCredentials } from "../app/passkey/login";
import { useState } from "react";
import { useAccount } from "@starknet-react/core";

export default function Passkey() {
    const [username, setUsername] = useState('');
    const [loginUsername, setLoginUsername] = useState('');
    const { address } = useAccount();

    return (
        <div className="mt-6 flex justify-center">
            <div className="bg-slate-100 shadow-xl justify-center rounded-lg p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">WebAuthn Passkey Demo</h1>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Register</h2>
                    <input type="text" onChange={(e) => setUsername(e.target.value)} id="register-username" placeholder="Username" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    <button onClick={() => registerPasskey(address)} className="w-full bg-blue-500 text-white font-semibold py-2 rounded-lg hover:bg-blue-600 transition duration-300">Register Passkey</button>
                    <p id="register-status" className="text-sm text-gray-600 mt-2"></p>
                </div>

                <div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Login</h2>
                    <input type="text" onChange={(e) => setLoginUsername(e.target.value)} id="login-username" placeholder="Username" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    <button onClick={loginCredentials} className="w-full bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-600 transition duration-300">Login with Passkey</button>
                    <p id="login-status" className="text-sm text-gray-600 mt-2"></p>
                </div>
            </div>
        </div>
    );
}

