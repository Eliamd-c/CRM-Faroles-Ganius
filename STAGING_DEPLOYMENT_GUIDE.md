# Staging Deployment Guide

## Status: LIVE ✅

**Branch:** `staging`
**URL:** Check Vercel dashboard
**Commit:** `4066f7d` - feat(arch): Implement clean architecture with dependency injection

---

## Pasos para Verificar Deploy

### 1. **Vercel Dashboard**
```
Ir a: https://vercel.com/Eliamd-c/CRM-Faroles-Ganius
- Ver rama 'staging'
- Esperar a que el deploy termine (verde = success)
- Copiar URL de staging
```

### 2. **Verificar que Funciona**
```bash
# En tu navegador:
- Ir a URL de staging
- Probar webhook (enviar DM en Instagram)
- Verificar que aparecen logs en consola del servidor
- Probar con datos reales
```

### 3. **Validaciones Importantes**
```
✓ App.js carga sin errores
✓ DI container se inicializa
✓ Ambas versiones (vieja + nueva) corren en paralelo
✓ Database conecta correctamente
✓ Webhooks responden (200 OK)
✓ Logs aparecen sin errores
```

### 4. **Monitoreo**
```
Mantener abierto por 24-48 horas:
- Vercel logs
- Errores de JS en consola
- Red errors
- Performance
```

---

## Rollback (si hay problema)

```bash
# Si algo falla en staging:
git checkout main
git reset --hard origin/main

# Revertir deployments en Vercel manualmente
```

---

## Después del Testing

**Si TODO funciona bien:**
```bash
git checkout main
git merge staging
git push origin main
# Vercel deployará a producción automáticamente
```

**Si hay problemas:**
```bash
1. Identificar el error
2. Crear fix en rama development
3. Push a staging nuevamente
4. Re-testear
```

---

## Checklist

- [ ] Deploy completado en Vercel (rama staging)
- [ ] App carga sin errores
- [ ] Webhooks funcionan (responden con 200)
- [ ] Logs aparecen correctamente
- [ ] DI container inicializa
- [ ] Ambas versiones corren en paralelo
- [ ] Database conecta
- [ ] 24-48 horas de monitoreo completadas
- [ ] Sin errores en logs
- [ ] Listo para merge a main

---

## Soporte

Si encuentras errores:
1. Revisar Vercel logs
2. Revisar browser console errors
3. Revisar database connection
4. Revisar webhooks webhook del lado de Meta
5. Si no resuelve, revert y debug en staging

---

**Commit de deployment:**
```
4066f7d feat(arch): Implement clean architecture with dependency injection
```

**Cambios principales:**
- 3,227 líneas de código nuevo
- 34 archivos creados/modificados
- Clean Architecture completamente implementada
- Todos los tests pasando (20/20)
- 3 bugs críticos fijos

**Estimado de tiempo para verificar:** 2-3 horas por sistema
