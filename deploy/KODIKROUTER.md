# KodikRouter: primary internet tutor

The internet tutor defaults to `kodikrouter/gpt-4.1-nano` (upstream model
`openai/gpt-4.1-nano`). Local/legacy OpenRouter integration and audio providers
remain separate. This text model does not perform speech recognition or synthesis.

Before activation:

1. Deploy the build, run PostgreSQL migrations (including 0017) and content seed.
2. In Coolify **runtime** variables set `AI_MODEL_KEY=kodikrouter/gpt-4.1-nano`.
   An existing explicit OpenRouter value is not overridden by the new default.
3. Store `KODIKROUTER_API_KEY` as a secret runtime variable, never a build argument,
   client variable, repository file, screenshot or chat message.
4. Confirm the model is allowed for that key and confirm the tariff in the provider
   account. The initial USD budget estimate is $0.11 input / $0.44 output per million
   tokens: public catalog $0.10/$0.40 plus the documented 10% commission. Cached
   input is conservatively counted at full input rate. This is not an invoice.
   Adjust price versions via the super-admin before activation if needed.
5. Enable AI for the family, include `kodikrouter/gpt-4.1-nano` in its allowedModels
   if that list is nonempty, and set user/family limits.
6. Only after approval of paid requests set `ENABLE_LIVE_AI=true` and redeploy.
7. Test short English and Italian answers: correct, incorrect, valid alternative,
   off-topic, and empty input. Confirm `mode=live`, useful Russian explanation,
   correct target language and nonzero usage in the ledger. Do not log answer
   bodies or authorization headers. A mocked test does not establish model quality.

Missing key or disabled live mode keeps demo mode. Provider errors fall back to
explicitly labelled demo, never to another paid provider. To deliberately select
OpenRouter, set `AI_MODEL_KEY=openrouter/gpt-4.1-mini` and its separate key.

Sources checked 2026-09-27:
- https://kodikrouter.ru/docs/base
- https://api.kodikrouter.ru/v1/catalog/models/openai%2Fgpt-4.1-nano
- https://developers.openai.com/api/docs/models/gpt-4.1-nano
