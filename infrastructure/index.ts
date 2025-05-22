import * as pulumi from "@pulumi/pulumi"
import * as resources from '@pulumi/azure-native/resources'
import * as containerregistry from '@pulumi/azure-native/containerregistry'
import * as dockerBuild from '@pulumi/docker-build'
import * as containerinstance from '@pulumi/azure-native/containerinstance'

// Load Config Values

const config = new pulumi.Config()
const appPath = config.require('appPath')
const prefixName = config.require('prefixName')
const imageName = prefixName
const imageTag = config.require('imageTag')
const containerPort = config.requireNumber('containerPort')
const publicPort = config.requireNumber('publicPort')
const cpu = config.requireNumber('cpu')
const memory = config.requireNumber('memory')

// Create Resource Group and Container Registry

const resourceGroup = new resources.ResourceGroup(`${prefixName}-rg`)

const registry = new containerregistry.Registry(`${prefixName}ACR`, {
  resourceGroupName: resourceGroup.name,
  adminUserEnabled: true,
  sku: { name: containerregistry.SkuName.Basic },
})

// Get Registry Credentials

const registryCredentials = containerregistry.listRegistryCredentialsOutput({
    resourceGroupName: resourceGroup.name,
    registryName: registry.name,
  }).apply((creds) => ({
    username: creds.username!,
    password: creds.passwords![0].value!,
  }))

  // Create and Push Docker Image

  const image = new dockerBuild.Image(`${prefixName}-image`, {
    tags: [pulumi.interpolate`${registry.loginServer}/${imageName}:${imageTag}`],
    context: { location: appPath },
    dockerfile: { location: `${appPath}/Dockerfile` },
    target: 'production',
    platforms: ['linux/amd64', 'linux/arm64'],
    push: true,
    registries: [
      {
        address: registry.loginServer,
        username: registryCredentials.username,
        password: registryCredentials.password,
      },
    ],
  })

  // Create Azure Container Instance

  const containerGroup = new containerinstance.ContainerGroup(`${prefixName}-container-group`, {
    resourceGroupName: resourceGroup.name,
    osType: 'linux',
    restartPolicy: 'always',
    imageRegistryCredentials: [{
      server: registry.loginServer,
      username: registryCredentials.username,
      password: registryCredentials.password,
    }],
    containers: [{
      name: imageName,
      image: image.ref,
      ports: [{ port: containerPort, protocol: 'tcp' }],
      environmentVariables: [
        { name: 'PORT', value: containerPort.toString() },
        { name: 'WEATHER_API_KEY', value: 'c1cd94d0c2cb97ac875ae02cd53a2c7d' }, // Replace with actual key
      ],
      resources: {
        requests: { cpu, memoryInGB: memory },
      },
    }],
    ipAddress: {
      type: containerinstance.ContainerGroupIpAddressType.Public,
      dnsNameLabel: `${imageName}`,
      ports: [{ port: publicPort, protocol: 'tcp' }],
    },
  })

  // Export Deployment Outputs

export const hostname = containerGroup.ipAddress.apply(addr => addr!.fqdn!)
export const ip = containerGroup.ipAddress.apply(addr => addr!.ip!)
export const url = containerGroup.ipAddress.apply(addr => `http://${addr!.fqdn!}:${containerPort}`)

  

