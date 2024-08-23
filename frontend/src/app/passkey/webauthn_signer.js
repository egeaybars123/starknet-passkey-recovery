import { uint256, transaction, encode, hash, num } from 'starknet'
import { loginCredentials } from './login';

export class WebAuthnSigner {
    constructor(pk) {
        this.pk =
            pk instanceof Uint8Array
                ? encode.buf2hex(pk).padStart(64, '0')
                : encode.removeHexPrefix(toHex(pk)).padStart(64, '0');
    }

    async signTransaction(transactions, details) {
        const compiledCalldata = transaction.getExecuteCalldata(transactions, details.cairoVersion);
        const det = details; 
        const msgHash = hash.calculateInvokeTransactionHash({
            ...det,
            senderAddress: det.walletAddress,
            compiledCalldata,
            version: det.version,
            nonceDataAvailabilityMode: intDAM(det.nonceDataAvailabilityMode),
            feeDataAvailabilityMode: intDAM(det.feeDataAvailabilityMode),
        });
        
        console.log("Message hash:", msgHash)
        return this.signRaw(msgHash)
    }
    async signRaw(msgHash) {
        const result = await loginCredentials(msgHash)
        const sig_r = uint256.bnToUint256(result.r)
        const sig_s = uint256.bnToUint256(result.s)

        return [
            num.toHex(1),
            num.toHex(sig_r.low),
            num.toHex(sig_r.high),
            num.toHex(sig_s.low),
            num.toHex(sig_s.high),
            num.toHex(result.extraData)
        ]
    }
}


function intDAM(dam) {
    if (dam === "L1" /* L1 */)
        return 0 /* L1 */;
    if (dam === "L2" /* L2 */)
        return 1 /* L2 */;
    throw Error("EDAM conversion");
}