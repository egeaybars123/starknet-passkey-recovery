import { startAuthentication } from '@simplewebauthn/browser';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getNewChallenge, convertChallenge, base64ToArrayBuffer, convertEcdsaAsn1Signature, uint8ArrayToHex, uint8ArrayToBigInt } from './utils';
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
    //console.log(options)
    const credentials = await startAuthentication(options)
    //console.log("Credentials: ", credentials)

    //Check if the additional key exists for signature verificaton on Starknet
    const clientDataJson = helpers.isoBase64URL.toUTF8String(credentials.response.clientDataJSON)
    console.log("ClientData: ", clientDataJson)
    console.log("Result", Object.keys(clientDataJson).includes("other_keys_can_be_added_here"))

    const rawPubKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWw-D-UcqK-5aMJNKykOXZurb-LZX1-sFeBGvL4GHRekyckym-gVuCmsQEdPTFWryTBHaUoiu_hwJC2Nxil0tpQ"
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
    console.log("ClientDataHash: ", uint8ArrayToHex(clientDataHash))
    const authDataBuffer = helpers.isoBase64URL.toBuffer(credentials.response.authenticatorData, "base64url")
    console.log("Auth Data: ", helpers.isoBase64URL.toBuffer(credentials.response.authenticatorData, "base64url").toString());
    const signatureBuffer = helpers.isoBase64URL.toBuffer(credentials.response.signature, "base64url")
    const signature = convertEcdsaAsn1Signature(signatureBuffer);
    console.log("signature_r: ", uint8ArrayToBigInt(new Uint8Array(signature.slice(0, 32))))
    console.log("signature_s: ", uint8ArrayToBigInt(new Uint8Array(signature.slice(32))))
    const signedData = helpers.isoUint8Array.concat([authDataBuffer, clientDataHash])

    const publicKeyJwk = {
        kty: "EC",
        crv: "P-256",
        x: helpers.isoBase64URL.fromBuffer(credPubKey_X, "base64url"),
        y: helpers.isoBase64URL.fromBuffer(credPubKey_Y, "base64url"),
        ext: true
    };

    const publicKey = await crypto.subtle.importKey(
        'jwk', 
        publicKeyJwk,  
        {
            name: 'ECDSA',
            namedCurve: 'P-256' 
        },
        true,
        ['verify'] 
    );
    console.log(publicKey)

    const isValid = await crypto.subtle.verify(
        {
            name: 'ECDSA',
            hash: { name: 'SHA-256' },
        },
        publicKey,
        signature,
        signedData 
    );
    console.log("Signature verification: ", isValid)

    return {
        extraData: Object.keys(clientDataJson).includes("other_keys_can_be_added_here"),
        challenge: buffer_challenge,
     }
};

