import { IBaseEvents, ITypedEventEmitter } from '@devtoolsweb/event-emitter'
import { IncomingMessage } from 'http'
import { IRpcRequest, IRpcResponse } from '@devtoolsweb/rpc-common'

export interface IBaseRpcBackend {
    readonly name?: string
}

export interface IRpcServerEvent {
    readonly server: IBaseRpcServer
}

export interface IRpcServerErrorEvent extends IRpcServerEvent {
    readonly errorDescription: string
    readonly requestData?: string
}

export interface IRpcServerRequestEvent extends IRpcServerEvent {
    readonly httpRequest: IncomingMessage
    readonly request: IRpcRequest
}

export interface IRpcServerResponseEvent extends IRpcServerEvent {
    readonly response: IRpcResponse
}

export interface IRpcServerEvents extends IBaseEvents {
    readonly connect: (event: IRpcServerEvent) => void
    readonly error: (event: IRpcServerErrorEvent) => void
    readonly request: (event: IRpcServerRequestEvent) => void
    readonly response: (event: IRpcServerResponseEvent) => void
}

export interface IBaseRpcServer extends ITypedEventEmitter<IRpcServerEvents> {
    readonly backends: Map<string, IBaseRpcBackend>
    readonly env: Record<string, unknown>
    readonly host: string
    readonly port: number
}

export class BaseRpcServer {}

export class BaseRpcBackend {

    get name () {
        return ''
    }

}
