import { Signer } from "starknet"

export class StarkSigner extends Signer {
    async signRaw(msgHash) {
        const sig = await super.signRaw(msgHash)
        console.log("Msg hash:", msgHash)
        return ["0", sig.r, sig.s]
    }
    
}