import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import * as helpers from '@simplewebauthn/server/helpers';

//import { decodeCredentialPublicKey } from '@simplewebauthn/server/script/helpers/decodeCredentialPublicKey'
//Credential ID: "hcelOAyw_qCfhfymQSkurD_4t7A"
export async function registerPasskey(username) {
    const rpId = 'localhost'
    const expectedOrigin = ['http://localhost:3000'];

    const newChallenge = getNewChallenge();
    let challenge = convertChallenge(newChallenge);
    const buffChallenge = base64urlToArrayBuffer(challenge)

    const options = await generateRegistrationOptions(
        {
            rpName: rpId,
            rpID: rpId,
            challenge: buffChallenge,
            userName: username,
            userID: stringToUint8Array(username),
            attestationType: 'none',
            authenticatorSelection: {
                // Defaults
                residentKey: 'preferred',
                userVerification: 'preferred',
                // Optional
                authenticatorAttachment: 'platform',
            },
            supportedAlgorithmIDs: [-7],

        }
    )

    const attObj = await startRegistration(options)
    console.log(attObj)

    const verification = await verifyRegistrationResponse({
        response: attObj,
        expectedChallenge: challenge,
        expectedOrigin: expectedOrigin,
        expectedRPID: rpId
    });
    console.log(verification)

    const parsedPubKey = helpers.decodeCredentialPublicKey(verification.registrationInfo.credentialPublicKey)
    console.log(parsedPubKey)
    console.log("x: ", parsedPubKey.get(-2), "y: ", parsedPubKey.get(-3))

    /*
    const pubKey = {
        challenge: challenge,
        rp: { id: rpId, name: 'starknet-passkey' },
        user: { id: stringToArrayBuffer(username), name: username, displayName: username },
        pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
        ],
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
            requireResidentKey: false,
        },
        attestation: "direct"
    };
    const credential = await navigator.credentials.create({ publicKey: pubKey })
    const attestationObj = credential.response.attestationObject
    console.log(attestationObj)
    console.log(credential.response.getPub)
    */

    /*
    let response = await fetch('http://localhost:8000/register/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const publicKey = await response.json();
    console.log("Public Key: ", publicKey)

    const fidoData = await fido2Create(publicKey, username);

    response = await fetch('http://localhost:8000/register/finish', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(fidoData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const response_finish = await response.json();
    console.log(response_finish);
    */
}

function getNewChallenge() {
    return Math.random().toString(36).substring(2);
}
function convertChallenge(challenge) {
    return btoa(challenge).replaceAll('=', '');
}

function base64urlToArrayBuffer(base64url) {
    // Replace base64url specific characters and add padding if necessary
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const base64Padded = base64 + padding;

    // Convert base64 string to a binary string
    const binaryString = atob(base64Padded);

    // Create an ArrayBuffer and fill it with binary string data
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
}

function stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
}

function stringToUint8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}