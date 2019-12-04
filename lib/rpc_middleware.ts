import { IRpcMessage, IRpcResult, RpcResult } from '@aperos/rpc-common'

export type RpcMessageHandler = (
  message: IRpcMessage
) => Promise<IRpcResult | null>

export interface IRpcMiddlewareParams {
  allMiddlewares: Map<string, IRpcMiddleware>
  env: Record<string, any>
}

export interface IRpcMiddleware {
  handleMessage(message: IRpcMessage): Promise<IRpcResult | null>
  getPropertyValue(name: string): Promise<any>
  setup(p: IRpcMiddlewareParams): void
}

export class RpcMiddleware implements IRpcMiddleware {
  private $allMiddlewares?: Map<string, IRpcMiddleware>
  private $env?: Record<string, any>

  async handleMessage (message: IRpcMessage): Promise<IRpcResult | null> {
    const method = (this as any)[message.verb]
    return method instanceof Function
      ? (method as RpcMessageHandler).call(this, message)
      : new RpcResult({
          comment: `Unknown verb '${message.verb}' in namespace '${
            message.namespace
          }'`,
          id: message.id,
          status: 'Failed'
        })
  }

  protected get allMiddlewares () {
    return this.$allMiddlewares!
  }

  protected get env () {
    return this.$env!
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
