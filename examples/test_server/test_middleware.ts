import { IRpcRequest } from '@aperos/rpc-common'
import { RpcMiddleware } from '../../lib'

export class TestMiddleware extends RpcMiddleware {
  async testMethod (request: IRpcRequest): Promise<string> {
    return `This is a test string: ${request.params?.hello}:${Math.random()}`
  }
}
