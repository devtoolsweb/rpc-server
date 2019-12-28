import {
  IRpcRequest,
  IRpcResponse,
  RpcError,
  RpcErrorCodeEnum,
  RpcResponse,
  IRpcError
} from '@aperos/rpc-common'
import {
  BaseRpcMiddleware,
  IBaseRpcMiddleware,
  IBaseRpcServer
} from './rpc_base'

export type RpcRequestHandler = (m: any) => Promise<object | IRpcError>

export interface IRpcMiddlewareOpts {
  convertExceptionsToErrors?: boolean
}

export interface IRpcMiddleware extends IBaseRpcMiddleware {
  handleRequest(request: IRpcRequest): Promise<IRpcResponse>
  getPropertyValue(name: string): Promise<any>
  setup(server: IBaseRpcServer): Promise<void>
}

const symRpcMethods = Symbol('RpcMiddleware.methods')

type RpcMethodMap = Map<string, RpcRequestHandler>

const isErrorResult = (result: unknown): result is IRpcError => {
  return result instanceof RpcError
}

export class RpcMiddleware extends BaseRpcMiddleware implements IRpcMiddleware {
  protected convertExceptionsToErrors: boolean
  protected server!: IBaseRpcServer

  constructor(p: IRpcMiddlewareOpts = {}) {
    super()
    this.convertExceptionsToErrors = p.convertExceptionsToErrors === true
  }

  async applyHooks(): Promise<void> {}

  async handleRequest(req: IRpcRequest): Promise<IRpcResponse> {
    const xs = (this as any)[symRpcMethods] as RpcMethodMap
    if (xs) {
      const method = xs.get(req.verb)
      if (method) {
        const id = req.id!
        try {
          const result = await method.call(this, req.params)
          return new RpcResponse({
            id,
            ...(isErrorResult(result) ? { error: result } : { result })
          })
        } catch (e) {
          if (this.convertExceptionsToErrors) {
            return new RpcResponse({
              id,
              error: new RpcError({
                code: RpcErrorCodeEnum.InternalError,
                message: e.message
              })
            })
          } else {
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
      id: req.id!
    })
  }

  /**
   * Can be used by other middleware.
   */
  async getPropertyValue(name: string): Promise<any> {
    return (this as any)[name]
  }

  async setup(server: IBaseRpcServer) {
    this.server = server
    await this.initialize()
  }

  protected async initialize() {}
}

export function RpcMethod(methodName?: string) {
  return (target: Object, key: string, descriptor: PropertyDescriptor) => {
    if (!(target instanceof RpcMiddleware)) {
      throw new Error(
        `Target class for @RpcMethod() must be and instance of RpcMiddleware`
      )
    }
    const name = methodName || key
    const p = Object.getPrototypeOf(target)
    let xs = p[symRpcMethods] as RpcMethodMap
    if (!xs) {
      xs = new Map<string, RpcRequestHandler>()
      p[symRpcMethods] = xs
    }
    if (xs.has(name)) {
      throw new Error(
        `Class '${p.name}' already implements the RPC method ${name}`
      )
    }
    xs.set(name, descriptor.value)
  }
}
