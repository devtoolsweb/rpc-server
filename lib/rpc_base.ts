import { ITypedEventEmitter, IBaseEvents } from '@aperos/event-emitter'
import { IRpcRequest, IRpcResponse } from '@aperos/rpc-common'
import { IncomingMessage } from 'http'

export interface IBaseRpcMiddleware {
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
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares: Map<string, IBaseRpcMiddleware>
  readonly port: number
}

export class BaseRpcServer {}

export class BaseRpcMiddleware {
  get name () {
    return ''
  }
}
