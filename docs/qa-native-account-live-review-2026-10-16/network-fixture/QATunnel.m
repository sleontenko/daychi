// Test process only: configure a normal proxy without changing request data,
// certificate validation, storage, or application source.
#import <Foundation/Foundation.h>
#import <objc/runtime.h>
static id (*originalDefault)(id, SEL);
static id (*originalEphemeral)(id, SEL);
static id configure(id config) {
  [config setConnectionProxyDictionary:@{
    @"HTTPEnable":@1, @"HTTPProxy":@"127.0.0.1", @"HTTPPort":@18088,
    @"HTTPSEnable":@1, @"HTTPSProxy":@"127.0.0.1", @"HTTPSPort":@18088,
    @"ExceptionsList":@[@"localhost",@"127.0.0.1",@"::1",@"192.168.*"],
    @"ExcludeSimpleHostnames":@1
  }];
  return config;
}
static id proxyDefault(id cls,SEL selector) { return configure(originalDefault(cls,selector)); }
static id proxyEphemeral(id cls,SEL selector) { return configure(originalEphemeral(cls,selector)); }
__attribute__((constructor)) static void installQATunnel(void) {
  @autoreleasepool {
    originalDefault=(void *)method_setImplementation(class_getClassMethod([NSURLSessionConfiguration class],@selector(defaultSessionConfiguration)),(IMP)proxyDefault);
    originalEphemeral=(void *)method_setImplementation(class_getClassMethod([NSURLSessionConfiguration class],@selector(ephemeralSessionConfiguration)),(IMP)proxyEphemeral);
  }
}
