import { BaseRpcBackend, IBaseRpcBackend, IBaseRpcServer } from './rpc_base'
import { IRpcError, IRpcRequest, IRpcResponse, JsonRpcId, RpcError, RpcErrorCodeEnum, RpcResponse } from '@devtoolsweb/rpc-common'

export type RpcRequestHandler = (m: unknown) => Promise<object | IRpcError>

export interface IRpcBackendArgs {
    convertExceptionsToErrors?: boolean
}

export interface IRpcBackend extends IBaseRpcBackend {
    getPropertyValue(name: string): Promise<unknown>
    handleRequest(request: IRpcRequest): Promise<IRpcResponse>
    setup(server: IBaseRpcServer): Promise<void>
}

const symRpcMethods = Symbol('RpcBackend.methods')

type RpcMethodMap = Map<string, RpcRequestHandler>

const isErrorResult = (result: unknown): result is IRpcError => {
    return result instanceof RpcError
}

export interface RpcBackend {
    [index: symbol]: unknown
    [index: string]: unknown
}

export class RpcBackend extends BaseRpcBackend implements IRpcBackend {

    protected convertExceptionsToErrors: boolean

    protected server!: IBaseRpcServer

    constructor (args: IRpcBackendArgs = {}) {
        super()
        this.convertExceptionsToErrors = args.convertExceptionsToErrors === true
    }

    async applyHooks (): Promise<void> {
        //
    }

    /**
     * Can be used by other backend.
     *
     * @param {string} name Propery name
     */
    async getPropertyValue (name: string): Promise<unknown> {
        return this[name]
    }

    async handleRequest (req: IRpcRequest): Promise<IRpcResponse> {
        const xs = this[symRpcMethods] as RpcMethodMap
        if (xs) {
            const method = xs.get(req.verb)
            if (method) {
                const id = req.id as JsonRpcId
                try {
                    const result = await method.call(this, req.params)
                    return new RpcResponse({
                        id,
                        ...(isErrorResult(result) ? { error: result } : { result })
                    })
                }
                catch (e) {
                    if (this.convertExceptionsToErrors) {
                        return new RpcResponse({
                            id,
                            error: new RpcError({
                                code: RpcErrorCodeEnum.InternalError,
                                message: (e as Error).message
                            })
                        })
                    }
                    else {
                        throw e
                    }
                }
            }
        }
        const message = xs
            ? `Unknown verb '${req.verb}' in domain '${req.domain}'`
            : `Domain '${req.domain}' doesn't contain verbs`
        this.server.emit('error', {
            server: this.server,
            errorDescription: message
        })
        return new RpcResponse({
            error: new RpcError({
                code: RpcErrorCodeEnum.MethodNotFound,
                message
            }),
            id: req.id as JsonRpcId
        })
    }

    async setup (server: IBaseRpcServer) {
        this.server = server
        await this.initialize()
    }

    protected async initialize () {
        //
    }

}

export function RpcMethod (methodName?: string) {
    return (target: object, key: string, descriptor: PropertyDescriptor) => {
        if (!(target instanceof RpcBackend)) {
            throw new Error('Target class for @RpcMethod() must be and instance of RpcBackend')
        }
        const name = methodName || key
        const p = Object.getPrototypeOf(target)
        let xs = p[symRpcMethods] as RpcMethodMap
        if (!xs) {
            xs = new Map<string, RpcRequestHandler>()
            p[symRpcMethods] = xs
        }
        if (xs.has(name)) {
            throw new Error(`Class '${p.name}' already implements the RPC method ${name}`)
        }
        xs.set(name, descriptor.value)
    }
}
