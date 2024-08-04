"use client";
import { registerPasskey } from "./passkey/register";
import { loginCredentials } from "./passkey/login";
import { useState } from "react";
import { StarknetProvider } from "@/components/StarknetProvider";
import WalletBar from "@/components/WalletBar";
import Passkey from "@/components/Passkey";


export default function Home() {
  const [username, setUsername] = useState('');
  const [loginUsername, setLoginUsername] = useState('');

  return (
    <StarknetProvider>
      <WalletBar />
      <Passkey />
    </StarknetProvider>

  );
}
