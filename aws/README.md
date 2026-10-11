# AgniGuard on AWS

The AWS edition of AgniGuard: the same app, the same `runRadar` logic (`@agniguard/logic`),
the same error semantics — hosted on AWS instead of Cloudflare. Built for the
WeMakeDevs **Environmental Hacks** hackathon (Air track), which requires every project
to use at least one AWS open-source tool or be deployed on AWS. This edition does both:
it is deployed on AWS and it is deployed **with** the open-source
[AWS SAM CLI](https://github.com/aws/aws-sam-cli).

```
Browser
   |
   v
CloudFront (one URL for everything, India edge locations)
   |-- /*        -> S3 (private, via OAC): the built frontend + prebuilt grids
   |-- /api/*    -> API Gateway (HTTP API) -> Lambda (nodejs22.x, arm64)
                        |
                        |-- GET  /api/radar?region=...   NASA FIRMS + Open-Meteo + grids
                        |-- POST /api/verify             Turnstile -> session cookie
                        |
                        +-- reads boundaries/states.bin and landcover/india.bin
                            from the same S3 bucket, once per warm container
```

`aws/lambda/index.ts` is a line-for-line port of `worker/src/index.ts`. Only the
platform bindings changed:

| Cloudflare | AWS |
|---|---|
| Worker fetch handler | Lambda behind API Gateway (payload format 2.0) |
| `ASSETS` binding (static fetch) | `GetObject` on the site bucket (`GRIDS_BUCKET`) |
| `RADAR_LIMITER` ratelimits binding | In-memory fixed-window limiter (per warm container — approximate) |
| `cf-connecting-ip` header | `requestContext.http.sourceIp` |
| Worker secrets | SAM parameters -> Lambda environment variables |
| Workers static assets | S3 + CloudFront (OAC), `/api/*` cache-disabled behaviour |

Turnstile is unchanged: it is a script plus a siteverify call and works on any host.

## Deploy

Prerequisites: an AWS account (the Free Tier is enough), the
[AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
and [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
installed and configured (`aws configure`), Node.js, and the two secrets below.

1. **Install dependencies** (repo root): `npm install`

2. **Make sure the prebuilt grids exist** under `frontend/public/` — they are
   generated, not committed. Either run the pipeline (see `pipeline/README.md`), or
   copy them from the live Cloudflare edition:

   ```powershell
   curl -o frontend/public/boundaries/states.bin https://agniguard.tigersh19991.workers.dev/boundaries/states.bin
   curl -o frontend/public/landcover/india.bin  https://agniguard.tigersh19991.workers.dev/landcover/india.bin
   ```

3. **Build the frontend and the Lambda bundle** (repo root): `npm run build` then
   `npm run build:lambda` — outputs `frontend/dist` (grids included) and a single
   ~12 KB `aws/dist/index.js`.

4. **Deploy the stack:**

   ```powershell
   sam deploy --template-file aws/template.yaml --stack-name agniguard --capabilities CAPABILITY_IAM --resolve-s3 --guided
   ```

   Answer the prompts; you will be asked for `FirmsMapKey` (your NASA FIRMS MAP_KEY)
   and `TurnstileSecret`. They are `NoEcho` parameters — never printed, never in the
   repo. When asked to save arguments to `samconfig.toml`, say **no** (it would store
   the parameter values in plaintext).

5. **Upload the site.** `sam deploy` prints `BucketName`, `DistributionId` and
   `SiteURL` under Outputs:

   ```powershell
   powershell -File aws/sync-site.ps1 -BucketName <BucketName> -DistributionId <DistributionId>
   ```

6. **Allow the new domain in Turnstile.** Cloudflare dashboard -> Turnstile -> your
   widget -> add the CloudFront domain (for example `d1234abcd.cloudfront.net`) to the
   widget's hostnames. Until you do, the human check will fail on the AWS URL.

7. **Smoke test** the `SiteURL`: pass the human check, pick a region, confirm fires
   (or a real "zero fires" answer) load, and tap a fire for the panel and voice alert.

Redeploy after code changes: `sam build --template-file aws/template.yaml && sam deploy`
(steps 4–5; guided answers are remembered if you saved non-secret config).

## Cost

Designed to sit inside the Free Tier / the hackathon's $200 credits: Lambda (1M free
requests/month), HTTP API (1M free requests/month for 12 months), S3 (5 GB),
CloudFront free usage, no NAT, no database, no always-on anything. Idle cost is zero,
same as the Cloudflare edition.

## Teardown

```powershell
aws s3 rm s3://<BucketName> --recursive
sam delete
```

## Honest limits of the port

- The rate limiter is per warm Lambda container, not globally per IP. The production
  answer is an AWS WAF rate rule on the distribution; it is noted, not built.
- The Lambda and the Worker duplicate the route logic by design until the two share
  one entry module; the header comment in `aws/lambda/index.ts` says so.
