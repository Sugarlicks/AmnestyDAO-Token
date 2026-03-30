<template>
  <q-select
    v-model="selectedLocale"
    :options="localeOptions"
    option-value="code"
    option-label="name"
    emit-value
    map-options
    dense
    filled
    :label="$t('language')"
    @update:model-value="onLocaleChange"
    style="min-width: 150px;"
  >
    <template v-slot:option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLocaleStore } from '../stores/locale';
import { useI18n } from 'vue-i18n';

defineOptions({
  name: 'LanguageSwitcher'
});

const localeStore = useLocaleStore();
const { locale } = useI18n();

const selectedLocale = ref(localeStore.currentLocale);

const localeOptions = computed(() => localeStore.availableLocales);

const onLocaleChange = (newLocale: string) => {
  localeStore.setLocale(newLocale);
  selectedLocale.value = newLocale;
};

onMounted(() => {
  selectedLocale.value = localeStore.currentLocale;
});
</script>

