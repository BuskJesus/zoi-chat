import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";
import { JwtService } from "@nestjs/jwt";
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
    constructor(private jwtService: JwtService) {
        console.log('constructed with', jwtService)
        super();
    }

    canActivate(context: ExecutionContext) {
        const ctx = GqlExecutionContext.create(context);
        const { req } = ctx.getContext();

        if (req?.connectionParams?.Authorization) {
            try {
                console.log('CP', req?.connectionParams);
                console.log(this.jwtService);
                const token = req.connectionParams.Authorization.replace('Bearer ', '');
                const user = this.jwtService.verify(token);
                req.user = user;
                return true;
            } catch (error) {
                console.error('WebSocket auth error:', error);
                return false;
            }
        }

        return super.canActivate(context);
    }

    getRequest(context: ExecutionContext) {
        const ctx = GqlExecutionContext.create(context);
        return ctx.getContext().req;
    }
}