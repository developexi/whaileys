import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Permite acesso público ao endpoint raiz (informações da API)
  if (req.path === '/') {
    return next();
  }

  // Pega o token do header Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticação não fornecido. Use o header: Authorization: Bearer SEU_TOKEN'
    });
  }

  // Formato esperado: "Bearer TOKEN_AQUI"
  const [bearer, token] = authHeader.split(' ');

  if (bearer !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Formato de token inválido. Use: Authorization: Bearer SEU_TOKEN'
    });
  }

  // Pega o token esperado das variáveis de ambiente
  const validToken = process.env.API_TOKEN || 'seu-token-super-secreto-aqui';

  if (token !== validToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticação inválido'
    });
  }

  // Token válido, continua para a rota
  next();
}
