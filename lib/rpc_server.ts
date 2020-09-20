import {
  IRpcRequest,
  IRpcResponseArgs,
  RpcError,
  RpcErrorCodeEnum,
  RpcResponse,
  RpcRequest
} from '@aperos/rpc-common'
import {
  EventEmitterMixin,
  EventEmitterConstructor
} from '@aperos/event-emitter'
import {
  BaseRpcServer,
  IBaseRpcBackend,
  IBaseRpcServer,
  IRpcServerEvents
} from './rpc_base'
import { IRpcBackend } from './rpc_backend'
import { IncomingMessage } from 'http'

export interface IRpcServerArgs {
  apiKeys?: string[]
  env?: Record<string, any>
  host?: string
  port: number
}

export interface IRpcServer extends IBaseRpcServer {
  addBackend(backend: IBaseRpcBackend, alias?: string): this
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
  readonly backends = new Map<string, IBaseRpcBackend>()
  readonly port: number

  private isInitialized = false

  protected constructor(args: IRpcServerArgs) {
    super()
    this.env = args.env || {}
    this.host = args.host || 'localhost'
    this.port = args.port
    if (args.apiKeys) {
      this.apiKeys = new Set<string>(args.apiKeys)
    }
  }

  addBackend(m: IBaseRpcBackend, alias?: string): this {
    const name = m.name || alias
    if (name) {
      this.backends.set(name, m)
      return this
    }
    throw new Error(`Backend alias must be specified`)
  }

  async start() {
    await this.ensureInitialized()
    await this.performStart()
  }

  async stop() {
    await this.performStop()
  }

  protected async authenticateRequest(r: IRpcRequest) {
    return !this.apiKeys || (r.apiKey && this.apiKeys.has(r.apiKey))
  }

  protected async dispatchRequest(request: IRpcRequest) {
    const m = this.backends.get(request.domain)
    const opts: IRpcResponseArgs = { id: request.id! }
    return m
      ? (m as IRpcBackend).handleRequest(request)
      : new RpcResponse({
          ...opts,
          error: new RpcError({
            code: RpcErrorCodeEnum.InvalidRequest,
            message: `Unknown RPC message domain: '${request.domain}'`
          })
        })
  }

  protected async handleRequestData(
    httpRequest: IncomingMessage,
    requestData: string
  ) {
    try {
      const request = new RpcRequest(
        RpcRequest.makePropsFromJson(JSON.parse(requestData))
      )
      if (request.method === 'ping') {
        return new RpcResponse({ id: request.id!, result: 'pong' })
      }
      this.emit('request', { httpRequest, request, server: this })
      return this.authenticateRequest(request)
        ? await this.dispatchRequest(request)
        : new RpcResponse({
            error: new RpcError({
              code: RpcErrorCodeEnum.AuthenticationRequired,
              message: 'Session not authenticated'
            }),
            id: request.id!
          })
    } catch (e) {
      this.emit('error', {
        errorDescription: e.message,
        requestData,
        server: this
      })
      return new RpcResponse({
        error: new RpcError({
          code: RpcErrorCodeEnum.AuthenticationRequired,
          message: e.message
        }),
        id: 0
      })
    }
  }

  protected async ensureInitialized() {
    if (!this.isInitialized) {
      for (const m of this.backends.values()) {
        await (m as IRpcBackend).setup(this)
      }
      this.isInitialized = true
    }
  }

  protected async performStart() {}

  protected async performStop() {}
}
