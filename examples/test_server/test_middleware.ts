import { IRpcRequest } from '@aperos/rpc-common'
import { RpcMiddleware, RpcMethod } from '../../lib'

interface ITestMethodParams {
  hello: string
}

interface ICalcSumParams {
  a: number,
  b: number
}

export class BaseMiddleware extends RpcMiddleware {
  @RpcMethod()
  async testMethod (request: IRpcRequest<ITestMethodParams>): Promise<string> {
    return `This is a test string: ${request.params?.hello}:${Math.random()}`
  }
}

export class TestMiddleware extends BaseMiddleware {
  @RpcMethod()
  async calcSum (request: IRpcRequest<ICalcSumParams>): Promise<number> {
    const p =  request.params!
    return p.a + p.b
  }
}
