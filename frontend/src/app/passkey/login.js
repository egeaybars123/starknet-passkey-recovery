import { startAuthentication } from '@simplewebauthn/browser';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getNewChallenge, convertChallenge, base64ToArrayBuffer, convertEcdsaAsn1Signature } from './utils';
import * as helpers from '@simplewebauthn/server/helpers';

//0x067981c7f9f55bcbdd4e0d0a9c5bbcea77dacb42cccbf13554a847d6353f728e
//"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0G8G_0m_ZgiZkfMdP8dedwA4LAwuMtu65tcWvXAW-oZWOZ1UUOCXTpbsleLmZUbRBwKfzuX-ozWTn87ng_Yvkg"
//"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEKnjhhDhAFP2ftHv8C3bEI8iPubw+JI6Xgflv3nIBA4QMBBmAkhwuI2M+w30NRb23OvqTIfuHkypKEXa3tdrASw=="
export async function loginCredentials() {
    const expectedOrigin = ['http://localhost:3000'];
    const rpId = 'localhost'

    const newChallenge = getNewChallenge()
    const challenge = convertChallenge(newChallenge)
    const buffer_challenge = base64ToArrayBuffer(challenge)
    console.log(challenge)

    const options = await generateAuthenticationOptions({
        rpID: rpId,
        challenge: buffer_challenge,
        userVerification: "preferred",
    })
    const credentials = await startAuthentication(options)
    console.log("Credentials: ", credentials)

    const rawPubKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0G8G_0m_ZgiZkfMdP8dedwA4LAwuMtu65tcWvXAW-oZWOZ1UUOCXTpbsleLmZUbRBwKfzuX-ozWTn87ng_Yvkg"
    const pubKeyArray = helpers.isoBase64URL.toBuffer(rawPubKey, "base64url")
    const extraData = new Uint8Array([165, 1, 2, 3, 38, 32, 1, 33, 88, 32,])
    const extraData2 = new Uint8Array([34, 88, 32])
    const credPubKey_X = pubKeyArray.subarray(27, 59)
    const credPubKey_Y = pubKeyArray.subarray(59, pubKeyArray.length)
    const totalLength = extraData.length + extraData2.length + credPubKey_X.length + credPubKey_Y.length;
    const combinedArray = new Uint8Array(totalLength);

    let offset = 0;
    combinedArray.set(extraData, offset);
    offset += extraData.length;

    combinedArray.set(credPubKey_X, offset);
    offset += credPubKey_X.length;

    combinedArray.set(extraData2, offset);
    offset += extraData2.length;

    combinedArray.set(credPubKey_Y, offset);

    const clientDataBuffer = helpers.isoBase64URL.toBuffer(credentials.response.clientDataJSON, "base64url")
    const clientDataHashBuffer = await crypto.subtle.digest('SHA-256', clientDataBuffer)
    const clientDataHash = new Uint8Array(clientDataHashBuffer)
    const authDataBuffer = helpers.isoBase64URL.toBuffer(credentials.response.authenticatorData, "base64url")
    const signatureBuffer = helpers.isoBase64URL.toBuffer(credentials.response.signature, "base64url")
    const signature = convertEcdsaAsn1Signature(signatureBuffer);
    const signedData = helpers.isoUint8Array.concat([authDataBuffer, clientDataHash])

    const publicKeyJwk = {
        kty: "EC",
        crv: "P-256",
        x: helpers.isoBase64URL.fromBuffer(credPubKey_X, "base64url"),
        y: helpers.isoBase64URL.fromBuffer(credPubKey_Y, "base64url"),
        ext: true
    };

    const publicKey = await crypto.subtle.importKey(
        'jwk', // The format of the key being imported
        publicKeyJwk,   // The key data in JWK format
        {
            name: 'ECDSA',
            namedCurve: 'P-256' // Ensure this matches the 'crv' in the JWK
        },
        true,   // Whether the key is extractable (e.g., can be exported)
        ['verify'] // The intended key usages
    );
    console.log(publicKey)

    const isValid = await crypto.subtle.verify(
        {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }, // WebAuthn uses SHA-256
        },
        publicKey, // Public key
        signature, // Signature (ArrayBuffer or Uint8Array)
        signedData // Data that was signed (ArrayBuffer or Uint8Array)
    );
    console.log("Signature verification: ", isValid)
};

