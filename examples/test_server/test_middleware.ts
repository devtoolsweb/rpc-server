import {
  IRpcMessage,
  RpcStandardResult,
  IRpcStandardResult
} from '@aperos/rpc-common'
import { RpcMiddleware } from '../../lib'

export class TestMiddleware extends RpcMiddleware {
  async testMethod (message: IRpcMessage): Promise<IRpcStandardResult<string>> {
    return new RpcStandardResult<string>({
      id: message.id,
      status: 'success',
      value: `This is a test string: ${message.args.hello}`
    })
  }
}
