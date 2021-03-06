import * as Express from 'express';
import 'reflect-metadata';
export namespace ExpressController {


export class Route {
  method: string;
  path: string;
  key: string | symbol;
  handlers: (Express.Handler | Express.RequestParamHandler)[];
};


export type Middleware = Express.Handler | string | symbol;

export const routesKey = Symbol('routesKey');
export const basePathKey = Symbol('basePathKey');


export function getRouteMetadata(target) {
  let routes: Route[] = Reflect.getMetadata(routesKey, target);

  if (!routes) {
    routes = [];
    Reflect.defineMetadata(routesKey, routes, target);
  }

  return routes;
};


export function route(method: string, path: string, middleware: Middleware[] = []) {
  return <T extends Express.Handler>(target: Object, key: string | symbol, descriptor: TypedPropertyDescriptor<T>) => {
    let routes = getRouteMetadata(target);

    let handlers = <Express.Handler[]> middleware
      .map((m) => getMiddleware(target, m));

    routes.push({method, path, key, handlers: [...handlers, descriptor.value]});
    return descriptor;
  };
};


export function basePath(path: string) {
  return Reflect.metadata(basePathKey, path);
};


export function get(path: string = '*', middleware: Middleware[] = []) {
  return route('get', path, middleware);
};


export function post(path: string = '*', middleware: Middleware[] = []) {
  return route('post', path, middleware);
};


export function put(path: string = '*', middleware: Middleware[] = []) {
  return route('put', path, middleware);
};


export function patch(path: string = '*', middleware: Middleware[] = []) {
  return route('patch', path, middleware);
};


export function del(path: string = '*', middleware: Middleware[] = []) {
  return route('delete', path, middleware);
};


export function options(path: string = '*', middleware: Middleware[] = []) {
  return route('options', path, middleware);
};


export function head(path: string = '*', middleware: Middleware[] = []) {
  return route('head', path, middleware);
};


export function use(path: string = '*') {
  return route('use', path);
};


export function all(path: string = '*', middleware: Middleware[] = []) {
  return route('all', path, middleware);
};


export function param(param: string) {
  return <T extends Express.RequestParamHandler>(target: Object, key: string | symbol, descriptor: TypedPropertyDescriptor<T>) => {
    let routes = getRouteMetadata(target);

    routes.push({method: 'param', path: param, key, handlers: [descriptor.value]});
    return descriptor;
  };
};


export function middleware(fn: Middleware) {
  return <T extends Express.Handler>(target: Object, key: string | symbol, descriptor: TypedPropertyDescriptor<T>) => {
    let routes = getRouteMetadata(target);
    let middleware = getMiddleware(target, fn);

    routes.push({method: null, path: null, key, handlers: [middleware]});
    return descriptor;
  };
};


function getMiddleware(target: Object, fn: Middleware): Express.Handler {
  if (fn instanceof Function) {
    return fn;

  } else {
    let middleware = target[fn];

    if (!middleware)
      throw new Error('could not find middlware method ' + fn.toString());

    return middleware;
  }
}


function trimslash(s) {
  return s[s.length - 1] === '/'
    ? s.slice(0, s.length - 1)
    : s;
}


export function getRoutes(target: Object): Route[] {
  let routes: Route[] = Reflect.getMetadata(routesKey, target) || [];
  let basePath = Reflect.getMetadata(basePathKey, target.constructor);

  if (basePath) {
    routes = routes.map(({method, path, key, handlers}) => 
      ({method, path: method === 'param' ? path : trimslash(basePath) + path, key, handlers}));
  }

  let groups: {[id: string]: Route[]} = routes
    .reduce((groups, route) => {
      if (!groups[route.key])
        groups[route.key] = [];

      groups[route.key].push(route);
      return groups;
    }, {});

  routes = [];
  
  for (let k in groups) {
    let group = groups[k];

    let middleware = group
      .filter((x) => x.method === null)
      .map(({handlers}) => handlers[0]);

    let notMiddleware = group
      .filter((x) => x.method !== null)
      .map(({method, path, key, handlers}) => 
        ({method, path, key, handlers: [...middleware, ...handlers].map((h) => h.bind(target))}));

    [].push.apply(routes, notMiddleware)
  }

  return routes;
};


export function register(router: Express.Router, target: Object) {
  let routes = getRoutes(target);

  for (let route of routes) {
    let args = [route.path, ...route.handlers];
    router[route.method].apply(router, args);
  }
};
}
