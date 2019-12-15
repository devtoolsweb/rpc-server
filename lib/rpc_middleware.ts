import {
  IRpcRequest,
  IRpcResponse,
  RpcErrorCodeEnum,
  RpcResponse,
  RpcError
} from '@aperos/rpc-common'
import { IBaseRpcServer, IBaseRpcMiddleware } from './rpc_base'

export type RpcRequestHandler = (m: IRpcRequest) => Promise<IRpcResponse | null>

export interface IRpcMiddlewareParams {
  server: IBaseRpcServer
}

export interface IRpcMiddleware extends IBaseRpcMiddleware {
  readonly name?: string
  handleRequest(request: IRpcRequest): Promise<IRpcResponse | null>
  getPropertyValue(name: string): Promise<any>
  setup(p: IRpcMiddlewareParams): Promise<void>
}

export class RpcMiddleware implements IRpcMiddleware {
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

  async setup (p: IRpcMiddlewareParams) {
    this.server = p.server
    await this.initialize()
  }

  protected async initialize () {}
}
