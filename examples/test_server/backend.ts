import { IRpcError, RpcError, RpcErrorCodeEnum } from '@devtoolsweb/rpc-common'
import { RpcBackend, RpcMethod } from '../../lib'

interface ITestMethodParams {
    hello: string
}

interface ICalcSumParams {
    a: number
    b: number
}

export class BaseBackend extends RpcBackend {

    @RpcMethod()
    async testMethod (p: ITestMethodParams): Promise<string> {
        return `This is a test string: ${p?.hello}:${Math.random()}`
    }

}

export class Backend extends BaseBackend {

    @RpcMethod()
    async calcSum (p: ICalcSumParams): Promise<number> {
        return p.a + p.b
    }

    @RpcMethod()
    async getErrorResult (): Promise<number | IRpcError> {
        return new RpcError({
            code: RpcErrorCodeEnum.InternalError,
            message: 'Internal error in the test backend occured'
        })
    }

    @RpcMethod()
    async methodWithException (): Promise<number | IRpcError> {
        throw new Error('Exception thrown in test backend')
    }

}
