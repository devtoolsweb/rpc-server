import { IRpcMessage, IRpcResult, RpcResult } from '@aperos/rpc-common'

export type RpcMessageHandler = (m: IRpcMessage) => Promise<IRpcResult | null>

export interface IRpcMiddlewareParams {
  allMiddlewares: Map<string, IRpcMiddleware>
  env: Record<string, any>
}

export interface IRpcMiddleware {
  handleMessage(message: IRpcMessage): Promise<IRpcResult | null>
  getPropertyValue(name: string): Promise<any>
  setup(p: IRpcMiddlewareParams): Promise<void>
}

export class RpcMiddleware implements IRpcMiddleware {
  private $allMiddlewares!: Map<string, IRpcMiddleware>
  private $env!: Record<string, any>

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

  protected get allMiddlewares () {
    return this.$allMiddlewares
  }

  protected get env () {
    return this.$env
  }

  async getPropertyValue (name: string): Promise<any> {
    return (this as any)[name]
  }

  async setup (p: IRpcMiddlewareParams) {
    this.$allMiddlewares = p.allMiddlewares
    this.$env = p.env
    await this.initialize()
  }

  protected async initialize () {}
}
