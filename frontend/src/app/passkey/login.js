import { startAuthentication } from '@simplewebauthn/browser';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { num, uint256 } from "starknet"
import {
    convertEcdsaAsn1Signature, uint8ArrayToHex, uint8ArrayToBigInt, hexStringToUint8Array,
    bufferToBase64URLString, base64URLStringToBuffer
} from './utils';
import * as helpers from '@simplewebauthn/server/helpers';

export async function loginCredentials(msgHash) {
    const rpId = 'localhost'
    const challenge = "cc3b37ed859e1a3d9ff28ba910382eba8fac02ac00449eba82449a02415b6e"
    const challenge_bytes = helpers.isoUint8Array.fromHex(challenge)
    const buffer_challenge = new Uint8Array(32)
    buffer_challenge[0] = 0
    buffer_challenge.set(challenge_bytes, 1)
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

    const clientDataBuffer = helpers.isoBase64URL.toBuffer(credentials.response.clientDataJSON, "base64url")

    const clientDataHashBuffer = await crypto.subtle.digest('SHA-256', clientDataBuffer)
    const clientDataHash = new Uint8Array(clientDataHashBuffer)
    console.log("ClientDataHash: ", uint8ArrayToHex(clientDataHash))
    const authDataBuffer = helpers.isoBase64URL.toBuffer(credentials.response.authenticatorData, "base64url")
    console.log("Auth Data: ", helpers.isoBase64URL.toBuffer(credentials.response.authenticatorData, "base64url").toString());
    const signatureBuffer = helpers.isoBase64URL.toBuffer(credentials.response.signature, "base64url")
    const signature = convertEcdsaAsn1Signature(signatureBuffer);
    const signature_s = uint8ArrayToBigInt(new Uint8Array(signature.slice(32)))
    const signature_r = uint8ArrayToBigInt(new Uint8Array(signature.slice(0, 32)))
    console.log("signature_r: ", signature_r)
    console.log("signature_s: ", signature_s)
    //const signedData = helpers.isoUint8Array.concat([authDataBuffer, clientDataHash])

    return {
        extraData: Object.keys(clientDataJson).includes("other_keys_can_be_added_here"),
        challenge: challenge,
        r: uint256.bnToUint256(signature_r),
        s: uint256.bnToUint256(signature_s),
     }
};


/*
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
    */