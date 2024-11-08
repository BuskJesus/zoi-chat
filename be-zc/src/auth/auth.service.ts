import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginInput } from './dto/login.input';
import { SignupInput as SignupInput } from './dto/signup.input';


@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginInput: LoginInput) {
    const user = await this.validateUser(loginInput.email, loginInput.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: this.jwtService.sign({ 
        sub: user.id,
        email: user.email 
      }),
      user,
    };
  }

  async signUp(signUpInput: SignupInput) {
    const password = await bcrypt.hash(signUpInput.password, 10);
    const user = await this.usersService.create({
      ...signUpInput,
      password,
    });

    return {
      accessToken: this.jwtService.sign({ 
        sub: user.id,
        email: user.email 
      }),
      user,
    };
  }
}