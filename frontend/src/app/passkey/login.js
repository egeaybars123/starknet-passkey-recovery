import { startAuthentication } from '@simplewebauthn/browser';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { uint256, num } from "starknet"
import {
    convertEcdsaAsn1Signature, uint8ArrayToHex, uint8ArrayToBigInt,
} from './utils';
import * as helpers from '@simplewebauthn/server/helpers';

//pub_key = 0x0295ae800856ef8bd7954ce34183a5ac1996692f55d47595b65e3466af2ffb21
export async function loginCredentials(msgHash) {
    const rpId = 'localhost'
    const challenge = msgHash
    console.log(challenge.length)
    //const challenge_bytes = helpers.isoUint8Array.fromHex(challenge)
    const challenge_bytes = num.hexToBytes(challenge)
    console.log(challenge_bytes)
    const buffer_challenge = challenge_bytes
    /*
    const buffer_challenge = new Uint8Array(32)
    buffer_challenge[0] = 0
    buffer_challenge.set(challenge_bytes, 1)
    */
    //console.log("Base64URL Encoded:", bufferToBase64URLString(buffer_challenge))

    //console.log("Buffer challenge", helpers.isoUint8Array.toHex(buffer_challenge))
    const options = await generateAuthenticationOptions({
        rpID: rpId,
        challenge: buffer_challenge,
        userVerification: "preferred",
    })
    const credentials = await startAuthentication(options)

    const clientDataJson = helpers.isoBase64URL.toUTF8String(credentials.response.clientDataJSON)
    //console.log("ClientData: ", clientDataJson)
    //console.log("Result", Object.keys(clientDataJson).includes("other_keys_can_be_added_here"))

    //const clientDataBuffer = helpers.isoBase64URL.toBuffer(credentials.response.clientDataJSON, "base64url")

    //const clientDataHashBuffer = await crypto.subtle.digest('SHA-256', clientDataBuffer)
    //const clientDataHash = new Uint8Array(clientDataHashBuffer)
    //console.log("ClientDataHash: ", uint8ArrayToHex(clientDataHash))
    //const authDataBuffer = helpers.isoBase64URL.toBuffer(credentials.response.authenticatorData, "base64url")
    //console.log("Auth Data: ", helpers.isoBase64URL.toBuffer(credentials.response.authenticatorData, "base64url").toString());
    const signatureBuffer = helpers.isoBase64URL.toBuffer(credentials.response.signature, "base64url")
    const signature = convertEcdsaAsn1Signature(signatureBuffer);
    const signature_s = uint8ArrayToBigInt(new Uint8Array(signature.slice(32)))
    const signature_r = uint8ArrayToBigInt(new Uint8Array(signature.slice(0, 32)))
    console.log("signature_r: ", signature_r)
    console.log("signature_s: ", signature_s)
    //const signedData = helpers.isoUint8Array.concat([authDataBuffer, clientDataHash])
    console.log("Msg hash:", msgHash)
    return {
        extraData: Object.keys(clientDataJson).includes("other_keys_can_be_added_here"),
        challenge: challenge,
        r: uint256.bnToUint256(signature_r),
        s: uint256.bnToUint256(signature_s),
     }
};
