import { IRpcRequest, IRpcResponse } from '@aperos/rpc-common'
import {
  IBaseEvents,
  ITypedEventEmitter,
  EventEmitterMixin,
  EventEmitterConstructor
} from '@aperos/event-emitter'
import { BaseRpcServer, IBaseRpcMiddleware, IBaseRpcServer } from './rpc_base'

export interface IRpcServerEvent {
  readonly server: IRpcServer
}

export interface IRpcServerErrorEvent extends IRpcServerEvent {
  readonly errorDescription: string
  readonly request: IRpcRequest
}

export interface IRpcServerRequestEvent extends IRpcServerEvent {
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

export interface IRpcServerOpts {
  env?: Record<string, any>
  host?: string
  port: number
}

export interface IRpcServer
  extends IBaseRpcServer,
    ITypedEventEmitter<IRpcServerEvents> {
  addMiddleware(m: IBaseRpcMiddleware, alias?: string): this
  start(): void
  stop(): void
}

export class RpcServer
  extends EventEmitterMixin<
    IRpcServerEvents,
    EventEmitterConstructor<BaseRpcServer>
  >(BaseRpcServer)
  implements IRpcServer {
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares = new Map<string, IBaseRpcMiddleware>()
  readonly port: number

  constructor (p: IRpcServerOpts) {
    super()
    this.env = p.env || {}
    this.host = p.host || 'localhost'
    this.port = p.port
  }

  addMiddleware (m: IBaseRpcMiddleware, alias?: string): this {
    const name = m.name || alias
    if (name) {
      this.middlewares.set(name, m)
      return this
    }
    throw new Error(`Middleware name must be specified`)
  }

  start () {}

  stop () {}
}
