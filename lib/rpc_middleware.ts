import {
  IRpcRequest,
  IRpcResponse,
  RpcError,
  RpcErrorCodeEnum,
  RpcResponse
} from '@aperos/rpc-common'
import {
  BaseRpcMiddleware,
  IBaseRpcMiddleware,
  IBaseRpcServer
} from './rpc_base'

export type RpcRequestHandler = (m: IRpcRequest) => Promise<IRpcResponse | null>

export interface IRpcMiddlewareOpts {
  server: IBaseRpcServer
}

export interface IRpcMiddleware extends IBaseRpcMiddleware {
  handleRequest(request: IRpcRequest): Promise<IRpcResponse | null>
  getPropertyValue(name: string): Promise<any>
  setup(p: IRpcMiddlewareOpts): Promise<void>
}

export class RpcMiddleware extends BaseRpcMiddleware implements IRpcMiddleware {
  protected server!: IBaseRpcServer

  async applyHooks (): Promise<void> {}

  async handleRequest (req: IRpcRequest): Promise<IRpcResponse | null> {
    const method = (this as any)[req.verb]
    return method instanceof Function
      ? (method as RpcRequestHandler).call(this, req)
      : new RpcResponse({
          error: new RpcError({
            code: RpcErrorCodeEnum.MethodNotFound,
            message: `Unknown verb '${req.verb}' in domain '${req.domain}'`
          }),
          id: req.id!
        })
  }

  /**
   * Can be used by other middleware.
   */
  async getPropertyValue (name: string): Promise<any> {
    return (this as any)[name]
  }

  async setup (p: IRpcMiddlewareOpts) {
    this.server = p.server
    await this.initialize()
  }

  protected async initialize () {}
}
