# Task: Fix TypeScript Build Errors

Run `cd ~/Documents/Projects/Urgent/急救侠-uniapp && npx vue-tsc --noEmit` to see current errors.

Fix these TypeScript build errors:

## 1. `src/utils/location.ts`
- Duplicate function implementations — clean up duplicate functions

## 2. `src/utils/subscribe.ts`
- Duplicate function implementations (requestSubscribe, subscribeToMissions defined multiple times)
- `wx` is not defined — need type declaration or conditional check
- Parameters have implicit `any` types — add explicit types

## 3. `src/utils/voice.ts`
- Variable `voice` redeclared on lines 167 and 180 — fix duplicate declarations

For each file:
- Delete duplicate functions, keep only one copy
- Add proper type annotations
- Fix any `wx` references with proper WeChat type handling
- Ensure `vue-tsc --noEmit` passes

After fixing, commit with message: `fix: resolve TypeScript build errors in utils (location/subscribe/voice)`
