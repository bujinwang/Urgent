<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('[急救侠] App Launch')
})

onShow(() => {
  console.log('[急救侠] App Show')
})

onHide(() => {
  console.log('[急救侠] App Hide')
})
</script>

<style lang="scss">
@import '@/styles/variables.scss';
@import '@/styles/animations.scss';
@import '@/styles/global.scss';
</style>
