import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getNearbyAeds, getAedById } from '@/api/aed'

export interface AedDevice {
  id: string
  name: string
  address: string
  distance: number
  lat: number
  lng: number
  status: 'available' | 'in_use' | 'maintenance'
  lastCheck: string
  custodian?: { name: string; phone: string }
}

export const useAedStore = defineStore('aed', () => {
  const devices = ref<AedDevice[]>(getNearbyAeds())
  const selectedDevice = ref<AedDevice | null>(null)

  const availableCount = ref(
    devices.value.filter((d) => d.status === 'available').length
  )

  function selectDevice(id: string) {
    selectedDevice.value = getAedById(id) || null
  }

  function refresh() {
    devices.value = getNearbyAeds()
    availableCount.value = devices.value.filter((d) => d.status === 'available').length
  }

  return { devices, selectedDevice, availableCount, selectDevice, refresh }
})
