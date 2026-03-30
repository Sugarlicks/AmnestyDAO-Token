<template>
  <q-page class="admin-chat-page">
    <div class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="ls-1">{{ $t('manageChatChannels') }}</div>
        <q-btn
          color="primary"
          icon="add"
          :label="$t('addChannel')"
          unelevated
          rounded
          @click="openEditDialog()"
          :size="isMobile ? 'sm' : 'md'"
          class="text-black q-mt-md"
        />
      </div>
    </div>

    <!-- Channels Table -->
    <div class="q-pt-none q-px-md">
      <q-table
        :rows="chats"
        :columns="columns"
        row-key="id"
        :loading="loading"
        :filter="searchQuery"
        class="channels-table"
        flat
        bordered
      >
      <template v-slot:top>
        <div class="row items-center justify-between full-width">
          <div class="row items-center q-gutter-sm">
            <q-input
              v-model="searchQuery"
              dense
              outlined
              :placeholder="$t('searchChannels')"
              class="q-mr-sm"
              :style="{ width: isMobile ? '150px' : '250px' }"
            >
              <template v-slot:append>
                <q-icon name="search" />
              </template>
            </q-input>
            <q-btn
              flat
              color="primary"
              icon="refresh"
              round
              @click="loadChannels"
              :loading="loading"
              class="text-black"
            />
          </div>
        </div>
      </template>

      <template v-slot:body-cell-image="props">
        <q-td :props="props">
          <q-avatar v-if="props.value" size="40px">
            <img :src="props.value" />
          </q-avatar>
          <q-icon v-else name="chat" size="40px" color="grey-4" />
        </q-td>
      </template>

      <template v-slot:body-cell-isPrivate="props">
        <q-td :props="props">
          <q-chip
            :label="props.value ? $t('private') : $t('public')"
            :color="props.value ? 'grey-7' : 'primary'"
            text-color="white"
            size="sm"
          />
        </q-td>
      </template>

      <template v-slot:body-cell-memberCount="props">
        <q-td :props="props">
          {{ props.value }} {{ $t('members') }}
        </q-td>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            flat
            round
            icon="edit"
            size="sm"
            @click="openEditDialog(props.row)"
            class="q-mr-xs"
          />
          <q-btn
            flat
            round
            icon="delete"
            color="negative"
            size="sm"
            @click="confirmDelete(props.row)"
          />
        </q-td>
      </template>
      </q-table>
    </div>

    <!-- Edit/Create Dialog -->
    <q-dialog v-model="editDialog" :maximized="isMobile">
      <q-card :style="isMobile ? '' : 'min-width: 600px'" style="background: #f9f9f9;">
        <q-card-section class="q-pb-none">
          <div class="row items-center no-wrap">
            <q-btn flat round icon="arrow_back" v-close-popup />
            <q-avatar size="30px" class="q-ml-sm" color="warning">
              <q-icon name="edit" size="18px" />
            </q-avatar>
            <div class="column q-ml-sm">
              <div class="text-subtitle1 text-weight-bold">
                {{ editingChat.id ? $t('editChat') : $t('createChannel') }}
              </div>
              <div class="text-caption text-grey-7">
                {{ editingChat.id ? $t('updateChannelDetails') : $t('addNewChannel') }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="saveChannel" class="q-gutter-md">
            <q-input
              v-model="editingChat.name"
              :placeholder="$t('enterChannelName')"
              filled
              dense
              :rules="[val => !!val || $t('channelNameRequired')]"
            />

            <!-- Image Upload -->
            <div class="q-mt-lg">
              <p class="text-subtitle2 q-mb-xs">{{ $t('channelImage') }}</p>
              <div class="row justify-center q-mb-md">
                <q-avatar color="grey-3" size="120px" class="cursor-pointer" @click="triggerImageInput">
                  <q-img
                    v-if="channelImagePreview"
                    :src="channelImagePreview"
                    style="width: 100%; height: 100%; object-fit: cover;"
                  />
                  <q-icon v-else name="image" size="48px" color="grey-5" />
                  <q-file
                    ref="imageFileInput"
                    v-model="imageFile"
                    accept="image/*"
                    class="hidden"
                    max-file-size="5242880"
                    @rejected="onImageRejected"
                    @update:model-value="handleImageUpload"
                  />
                </q-avatar>
              </div>
            </div>

            <q-toggle
              v-model="editingChat.isPrivate"
              :label="$t('privateChannel')"
              class="q-mt-md"
            />

            <q-btn
              :label="editingChat.id ? $t('updateChannel') : $t('createChannel')"
              type="submit"
              unelevated
              class="q-mt-md"
              :loading="saving"
              :style="'width: 100%; background: #FFFF00; color: #000;'"
            />

            <div class="row justify-end q-mt-md">
              <q-btn
                :label="$t('cancel')"
                flat
                v-close-popup
                :style="'color: #666;'"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="deleteDialog">
      <q-card>
        <q-card-section class="row items-center">
          <q-icon name="warning" color="negative" size="2em" />
          <span class="q-ml-sm">{{ $t('areYouSureDeleteChannel') }}</span>
        </q-card-section>

        <q-card-section>
          <div class="text-body2">
            <strong>{{ channelToDelete?.name }}</strong>
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ $t('actionCannotBeUndone') }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup />
          <q-btn
            flat
            :label="$t('delete')"
            color="negative"
            @click="deleteChannel"
            :loading="deleting"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { QTableColumn, QFile } from 'quasar';
import { useChatStore, type Chat } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getImageUrl, imageDataToBase64 } from '../utils/imageUtils';

const { t } = useI18n();

defineOptions({
  name: 'AdminChat'
});

const $q = useQuasar();
const router = useRouter();
const chatStore = useChatStore();
const authStore = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const searchQuery = ref('');
const isMobile = ref($q.screen.lt.sm);

const chats = ref<Chat[]>([]);
const editDialog = ref(false);
const deleteDialog = ref(false);
const channelToDelete = ref<Chat | null>(null);
const imageFile = ref<File | null>(null);
const imageFileInput = ref<InstanceType<typeof QFile> | null>(null);
const channelImagePreview = ref<string | null>(null);

const editingChat = ref<{
  id?: string;
  name: string;
  isPrivate: boolean;
  image: string | null;
}>({
  name: '',
  isPrivate: false,
  image: null
});

const columns: QTableColumn[] = [
  {
    name: 'image',
    label: 'Image',
    field: 'image',
    align: 'center',
    sortable: false
  },
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    align: 'left',
    sortable: true
  },
  {
    name: 'isPrivate',
    label: 'Type',
    field: 'isPrivate',
    align: 'center',
    sortable: true
  },
  {
    name: 'memberCount',
    label: 'Members',
    field: 'memberCount',
    align: 'right',
    sortable: true
  },
  {
    name: 'lastMessage',
    label: 'Last Message',
    field: 'lastMessage',
    align: 'left',
    sortable: false,
    format: (val: string) => val || t('noMessagesYet')
  },
  {
    name: 'actions',
    label: 'Actions',
    field: 'actions',
    align: 'center',
    sortable: false
  }
];

const loadChannels = async () => {
  loading.value = true;
  try {
    await chatStore.fetchChats();
    chats.value = chatStore.chats.map(chat => {
      // Use unified image utility for consistent handling
      const result = getImageUrl(chat.image);
      return {
        ...chat,
        image: result.url
      };
    });
  } catch (error: any) {
    console.error('Failed to load channels:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadChannels')
    });
  } finally {
    loading.value = false;
  }
};

const openEditDialog = (chat?: Chat) => {
  if (chat) {
    // Convert image to base64 for editing using unified utility
    const base64Image = imageDataToBase64(chat.image);
    
    editingChat.value = {
      id: chat.id,
      name: chat.name,
      isPrivate: chat.isPrivate,
      image: base64Image
    };
    channelImagePreview.value = chat.image;
  } else {
    editingChat.value = {
      name: '',
      isPrivate: false,
      image: null
    };
    channelImagePreview.value = null;
  }
  imageFile.value = null;
  editDialog.value = true;
};

const triggerImageInput = () => {
  imageFileInput.value?.pickFiles();
};

const handleImageUpload = (file: File | null) => {
  if (!file) return;
  channelImagePreview.value = URL.createObjectURL(file);
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result as string;
    const base64Data = base64String.split(',')[1];
    editingChat.value.image = base64Data;
  };
  reader.readAsDataURL(file);
};

const onImageRejected = () => {
  $q.notify({
    type: 'negative',
    message: t('fileTooLarge')
  });
};

const saveChannel = async () => {
  if (!authStore.jwt) {
    $q.notify({
      type: 'negative',
      message: t('notAuthenticated')
    });
    return;
  }

  saving.value = true;
  try {
    if (editingChat.value.id) {
      // Update existing channel
      await chatStore.updateChat(editingChat.value.id, {
        name: editingChat.value.name,
        isPrivate: editingChat.value.isPrivate,
        image: editingChat.value.image
      });
      
      $q.notify({
        type: 'positive',
        message: t('channelUpdatedSuccessfully')
      });
    } else {
      // Create new channel
      await chatStore.createChat({
        name: editingChat.value.name,
        isPrivate: editingChat.value.isPrivate,
        image: editingChat.value.image
      });
      
      $q.notify({
        type: 'positive',
        message: t('channelCreatedSuccessfully')
      });
    }
    
    editDialog.value = false;
    await loadChannels();
  } catch (error: any) {
    console.error('Failed to save channel:', error);
    $q.notify({
      type: 'negative',
      message: error.message || t('failedToSaveChannel')
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (chat: Chat) => {
  channelToDelete.value = chat;
  deleteDialog.value = true;
};

const deleteChannel = async () => {
  if (!channelToDelete.value || !authStore.jwt) {
    return;
  }

  deleting.value = true;
  try {
    // Note: You'll need to add a deleteChat method to the chat store
    // For now, this is a placeholder
    $q.notify({
      type: 'info',
      message: t('deleteFunctionalityNeedsImplementation')
    });
    
    deleteDialog.value = false;
    channelToDelete.value = null;
    await loadChannels();
  } catch (error: any) {
    console.error('Failed to delete channel:', error);
    $q.notify({
      type: 'negative',
      message: error.message || t('failedToDeleteChannel')
    });
  } finally {
    deleting.value = false;
  }
};

onMounted(async () => {
  await loadChannels();
});
</script>

<style scoped lang="scss">
.admin-chat-page {
  background-color: #f5f5f5;
}

.channels-table {
  background-color: white;
  border-radius: 12px;
}

.hidden {
  display: none;
}
</style>

