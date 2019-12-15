import { IRpcRequest } from '@aperos/rpc-common'
import { RpcMiddleware } from '../../lib'

interface ITestMethodParams {
  hello: string
}

interface ICalcSumParams {
  a: number,
  b: number
}

export class TestMiddleware extends RpcMiddleware {
  async testMethod (request: IRpcRequest<ITestMethodParams>): Promise<string> {
    return `This is a test string: ${request.params?.hello}:${Math.random()}`
  }

  async calcSum (request: IRpcRequest<ICalcSumParams>): Promise<number> {
    const p =  request.params!
    return p.a + p.b
  }
}
