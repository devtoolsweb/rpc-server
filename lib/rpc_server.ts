import {
  IRpcRequest,
  IRpcResponse,
  IRpcResponseOpts,
  RpcError,
  RpcErrorCodeEnum,
  RpcResponse
} from '@aperos/rpc-common'
import {
  IBaseEvents,
  ITypedEventEmitter,
  EventEmitterMixin,
  EventEmitterConstructor
} from '@aperos/event-emitter'
import { BaseRpcServer, IBaseRpcMiddleware, IBaseRpcServer } from './rpc_base'
import { IRpcMiddleware } from './rpc_middleware'

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
  apiKeys?: string[]
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
  readonly apiKeys?: Set<string>
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares = new Map<string, IBaseRpcMiddleware>()
  readonly port: number

  private isInitialized = false

  constructor (p: IRpcServerOpts) {
    super()
    this.env = p.env || {}
    this.host = p.host || 'localhost'
    this.port = p.port
    if (p.apiKeys) {
      this.apiKeys = new Set<string>(p.apiKeys)
    }
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

  protected async authenticateRequest (r: IRpcRequest) {
    return !this.apiKeys || (r.apiKey && this.apiKeys.has(r.apiKey))
  }

  protected async dispatchRequest (request: IRpcRequest) {
    const m = this.middlewares.get(request.domain)
    const opts: IRpcResponseOpts = { id: request.id! }
    if (m) {
      opts.result = await (m as IRpcMiddleware).handleRequest(request)
    } else {
      opts.error = new RpcError({
        code: RpcErrorCodeEnum.InvalidRequest,
        message: `Unknown RPC message domain: '${request.domain}'`
      })
    }
    return new RpcResponse(opts)
  }

  protected async ensureInitialized () {
    if (!this.isInitialized) {
      for (const m of this.middlewares.values()) {
        await (m as IRpcMiddleware).setup({ server: this })
      }
      this.isInitialized = true
    }
  }
}
