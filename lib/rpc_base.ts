import { IRpcRequest, IRpcResponse } from '@aperos/rpc-common'
import {
  IBaseEvents,
  ITypedEventEmitter,
  EventEmitterMixin,
  EventEmitterConstructor
} from '@aperos/event-emitter'

export interface IBaseRpcMiddleware {
  readonly name?: string
}

export interface IBaseRpcServer {
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares: Map<string, IBaseRpcMiddleware>
  readonly port: number
}

export interface IBaseRpcServerOpts {
  env?: Record<string, any>
  host?: string
  port?: number
}

export interface IBaseRpcServerEvent {
  readonly server: IBaseRpcServer
}

export interface IRpcServerEvent extends IBaseRpcServerEvent {
  readonly request?: IRpcRequest
}

export interface IRpcServerErrorEvent extends IRpcServerEvent {
  readonly errorDescription: string
}

export interface IRpcServerRequestEvent extends IRpcServerEvent {
  readonly request: IRpcRequest
}

export interface IRpcServerResponseEvent extends IRpcServerEvent {
  readonly response: IRpcResponse
}

export interface IRpcServerEvents extends IBaseEvents {
  readonly connect: (event: IBaseRpcServerEvent) => void
  readonly error: (event: IRpcServerErrorEvent) => void
  readonly request: (event: IRpcServerRequestEvent) => void
  readonly response: (event: IRpcServerResponseEvent) => void
}

export interface IRpcServer
  extends IBaseRpcServer,
    ITypedEventEmitter<IRpcServerEvents> {
  addMiddleware(m: IBaseRpcMiddleware, alias?: string): this
  start(): void
  stop(): void
}

export class BaseRpcServer implements IBaseRpcServer {
  static readonly standardHost = 'localhost'
  static readonly standardPort = 9555

  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares = new Map<string, IBaseRpcMiddleware>()
  readonly port: number

  constructor (p: IBaseRpcServerOpts) {
    this.env = p.env || {}
    this.host = p.host || BaseRpcServer.standardHost
    this.port = p.port || BaseRpcServer.standardPort
  }

  addMiddleware (m: IBaseRpcMiddleware, alias?: string): this {
    const name = m.name || alias
    if (name) {
      this.middlewares.set(name, m)
      return this
    }
    throw new Error(`Middleware name must be specified`)
  }
}

export class RpcServer
  extends EventEmitterMixin<
    IRpcServerEvents,
    EventEmitterConstructor<BaseRpcServer>
  >(BaseRpcServer)
  implements IRpcServer {
  start () {}
  stop () {}
}
