import { i18n } from "#imports"
import { PLATFORM_TARGET } from "@/utils/platform"
import { PageLayout } from "../../components/page-layout"
import AppearanceSettings from "./appearance-settings"
import FeatureProvidersConfig from "./feature-providers-config"
import LanguageDetectionConfig from "./language-detection-config"
import SiteControlMode from "./site-control-mode"

export function GeneralPage() {
  const isThunderbird = PLATFORM_TARGET === "thunderbird"

  return (
    <PageLayout title={i18n.t("options.general.title")} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <FeatureProvidersConfig />
      <LanguageDetectionConfig />
      {!isThunderbird && <SiteControlMode />}
      <AppearanceSettings />
    </PageLayout>
  )
}
