import { i18n } from "#imports"
import { PLATFORM_TARGET } from "@/utils/platform"
import { PageLayout } from "../../components/page-layout"
import { AIContentAware } from "./ai-content-aware"
import { AutoTranslateLanguages } from "./auto-translate-languages"
import { AutoTranslateWebsitePatterns } from "./auto-translate-website-patterns"
import { ClearCacheConfig } from "./clear-cache-config"
import { CustomTranslationStyle } from "./custom-translation-style"
import { NodeTranslationHotkey } from "./node-translation-hotkey"
import { PageTranslationShortcut } from "./page-translation-shortcut"
import { PersonalizedPrompts } from "./personalized-prompt"
import { PreloadConfig } from "./preload-config"
import { RequestBatch } from "./request-batch"
import { RequestRate } from "./request-rate"
import { SkipLanguages } from "./skip-languages"
import { SmallParagraphFilter } from "./small-paragraph-filter"
import { TranslateRange } from "./translate-range"
import { TranslationMode } from "./translation-mode"

export function TranslationPage() {
  const isThunderbird = PLATFORM_TARGET === "thunderbird"

  return (
    <PageLayout title={i18n.t("options.translation.title")} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <TranslationMode />
      {!isThunderbird && <TranslateRange />}
      {!isThunderbird && <PageTranslationShortcut />}
      {!isThunderbird && <NodeTranslationHotkey />}
      {!isThunderbird && <CustomTranslationStyle />}
      {!isThunderbird && <AIContentAware />}
      <PersonalizedPrompts />
      {!isThunderbird && <AutoTranslateWebsitePatterns />}
      {!isThunderbird && <AutoTranslateLanguages />}
      {!isThunderbird && <SkipLanguages />}
      <RequestRate />
      <RequestBatch />
      {!isThunderbird && <PreloadConfig />}
      <SmallParagraphFilter />
      <ClearCacheConfig />
    </PageLayout>
  )
}
