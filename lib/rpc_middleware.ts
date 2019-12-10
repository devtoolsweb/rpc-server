import { IRpcMessage, IRpcResult, RpcResult } from '@aperos/rpc-common'
import { IBaseRpcServer, IBaseRpcMiddleware } from './rpc_base'

export type RpcMessageHandler = (m: IRpcMessage) => Promise<IRpcResult | null>

export interface IRpcMiddlewareParams {
  server: IBaseRpcServer
}

export interface IRpcMiddleware extends IBaseRpcMiddleware {
  readonly name?: string
  handleMessage(message: IRpcMessage): Promise<IRpcResult | null>
  getPropertyValue(name: string): Promise<any>
  setup(p: IRpcMiddlewareParams): Promise<void>
}

export class RpcMiddleware implements IRpcMiddleware {
  protected server!: IBaseRpcServer

  async applyHooks (): Promise<void> {}

  async handleMessage (msg: IRpcMessage): Promise<IRpcResult | null> {
    const method = (this as any)[msg.verb]
    return method instanceof Function
      ? (method as RpcMessageHandler).call(this, msg)
      : new RpcResult({
          comment: `Unknown verb '${msg.verb}' in domain '${msg.domain}'`,
          id: msg.id,
          status: 'failed'
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
