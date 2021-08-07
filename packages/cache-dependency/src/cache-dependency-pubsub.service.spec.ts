import { redisStore } from "@anchan828/nest-cache-manager-ioredis";
import { Test, TestingModule } from "@nestjs/testing";
import * as LRU from "lru-cache";
import { CacheDependencyModule } from "./cache-dependency.module";
import { CacheDependencyService } from "./cache-dependency.service";
import { wait } from "./test.utils";
describe("CacheDependencyPubSubService", () => {
  let apps: TestingModule[] = [];
  beforeEach(async () => {
    apps = [];
    for (let i = 0; i < 10; i++) {
      const module = await Test.createTestingModule({
        imports: [
          CacheDependencyModule.register({
            store: redisStore,
            host: process.env.REDIS_HOST || "localhost",
            pubsub: { host: "localhost" },
            enabledInMemory: true,
            inMemoryTTL: 60 * 60,
          }),
        ],
      }).compile();

      const app = await module.init();
      apps.push(app);
    }
  });

  afterEach(async () => {
    await wait(500);
    await Promise.all(apps.map((app) => app.close()));
  });

  it("should clear cache in all apps", async () => {
    const service = apps[0].get(CacheDependencyService);

    await Promise.all(
      apps.map((app) =>
        app.get(CacheDependencyService).createCacheDependencies((graph) => {
          graph.addNode("key1", "A");
          graph.addNode("key2", "B");
          graph.addDependency("key1", "key2");
        }),
      ),
    );

    expect(
      apps
        .map((app) => app.get(CacheDependencyService)["cacheManager"])
        .map((manager) => Reflect.get(manager, "store")?.memoryCache)
        .filter((lru): lru is LRU.Cache<string, any> => lru)
        .map((lru) => lru.values()),
    ).toEqual([
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
      [["key2"], "A", "B"],
    ]);

    await service.clearCacheDependencies("key1");

    await wait(1000);

    expect(
      apps
        .map((app) => app.get(CacheDependencyService)["cacheManager"])
        .map((manager) => Reflect.get(manager, "store")?.memoryCache)
        .filter((lru): lru is LRU.Cache<string, any> => lru)
        .map((lru) => lru.values()),
    ).toEqual([[], [], [], [], [], [], [], [], [], []]);
  });
});
