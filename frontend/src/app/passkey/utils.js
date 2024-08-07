export function getNewChallenge() {
    return Math.random().toString(36).substring(2);
}
export function convertChallenge(challenge) {
    return btoa(challenge).replaceAll('=', '');
}
export function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function readAsn1IntegerSequence(input) {
    if (input[0] !== 0x30) throw new Error('Input is not an ASN.1 sequence');
    const seqLength = input[1];
    const elements = [];


    let current = input.slice(2, 2 + seqLength);
    while (current.length > 0) {
        const tag = current[0];
        if (tag !== 0x02) throw new Error('Expected ASN.1 sequence element to be an INTEGER');


        const elLength = current[1];
        elements.push(current.slice(2, 2 + elLength));


        current = current.slice(2 + elLength);
    }
    return elements;
}

export function convertEcdsaAsn1Signature(input) {
    const elements = readAsn1IntegerSequence(input);
    if (elements.length !== 2) throw new Error('Expected 2 ASN.1 sequence elements');
    let [r, s] = elements;


    // R and S length is assumed multiple of 128bit.
    // If leading is 0 and modulo of length is 1 byte then
    // leading 0 is for two's complement and will be removed.
    if (r[0] === 0 && r.byteLength % 16 == 1) {
        r = r.slice(1);
    }
    if (s[0] === 0 && s.byteLength % 16 == 1) {
        s = s.slice(1);
    }


    // R and S length is assumed multiple of 128bit.
    // If missing a byte then it will be padded by 0.
    if ((r.byteLength % 16) == 15) {
        r = new Uint8Array(mergeBuffer(new Uint8Array([0]), r));
    }
    if ((s.byteLength % 16) == 15) {
        s = new Uint8Array(mergeBuffer(new Uint8Array([0]), s));
    }


    // If R and S length is not still multiple of 128bit,
    // then error
    if (r.byteLength % 16 != 0) throw Error("unknown ECDSA sig r length error");
    if (s.byteLength % 16 != 0) throw Error("unknown ECDSA sig s length error");


    return mergeBuffer(r, s);
}

function mergeBuffer(buffer1, buffer2) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

export function uint8ArrayToHex(uint8Array) {
    return Array.from(uint8Array)
        .map(byte => byte.toString(16).padStart(2, '0')) // Convert each byte to hex and pad with 0 if necessary
        .join(''); // Join all the hex strings together
}

export function uint8ArrayToBigInt(uint8Array) {
    if (uint8Array.length !== 32) {
        throw new Error("Invalid Uint8Array length for u256. Expected 32 bytes.");
    }

    let hexString = "0x";
    for (const byte of uint8Array) {
        hexString += byte.toString(16).padStart(2, "0");
    }

    return BigInt(hexString);
}