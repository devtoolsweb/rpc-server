export interface IRpcSessionArgs {
    timeout?: number
}

export interface IRpcSession {
    readonly isAlive: boolean
    readonly timeout: number
    reset(): this
}

export class RpcSession implements IRpcSession {

    static standardTimeout = 30000

    readonly timeout: number

    private startTime: Date = new Date()

    constructor (args: IRpcSessionArgs) {
        const t = args.timeout || 0
        this.timeout = t > 0 ? t : RpcSession.standardTimeout
    }

    get isAlive () {
        return new Date().getTime() - this.startTime.getTime() < this.timeout
    }

    reset () {
        this.startTime = new Date()
        return this
    }

}
