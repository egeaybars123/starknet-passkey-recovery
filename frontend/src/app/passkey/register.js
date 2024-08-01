import { fido2Get, fido2Create, } from '@ownid/webauthn';

export async function registerPasskey(username) {
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
}

export function hello(username) {
    console.log(username)
}