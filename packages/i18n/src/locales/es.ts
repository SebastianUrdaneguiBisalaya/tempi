import type { Messages } from '../types';
import type { en } from './en';

export const es = {
	common: {
		actions: {
			cancel: 'Cancelar',
			close: 'Cerrar',
			confirm: 'Confirmar',
			create: 'Crear',
			delete: 'Eliminar',
			edit: 'Editar',
			save: 'Guardar',
		},
	},
	errors: {
		calendar: {
			color: 'Elige un color válido.',
			defaultNotDeletable: 'El calendario predeterminado no se puede eliminar.',
			defaultRequired: 'Primero marca otro calendario como predeterminado.',
			notFound: 'Este calendario ya no existe.',
		},
		event: {
			endBeforeStart: 'El fin debe ser posterior al inicio.',
			notFound: 'Este evento ya no existe.',
			rrule: 'La regla de repetición no es válida.',
		},
		profile: {
			country: 'Elige un país válido.',
		},
		range: {
			endBeforeStart: 'El fin del rango debe ser posterior a su inicio.',
		},
		validation: {
			custom: 'Este valor no es válido.',
			instant: 'Introduce una fecha y hora válidas.',
			integer: 'Introduce un número entero.',
			invalid_element: 'Uno de los elementos no es válido.',
			invalid_format: 'El formato no es válido.',
			invalid_key: 'Una de las claves no es válida.',
			invalid_type: 'Este valor tiene un tipo incorrecto.',
			invalid_union: 'Este valor no es válido.',
			invalid_value: 'Elige una de las opciones disponibles.',
			max: 'Debe ser {{maximum}} o menos.',
			min: 'Debe ser {{minimum}} o más.',
			not_multiple_of: 'Debe ser múltiplo de {{divisor}}.',
			required: 'Este campo es obligatorio.',
			timeZone: 'Elige una zona horaria válida.',
			too_big: 'Debe ser {{maximum}} o menos.',
			too_small: 'Debe ser {{minimum}} o más.',
			unrecognized_keys: 'Hay campos desconocidos.',
			url: 'Introduce un enlace http(s) válido.',
		},
	},
} as const satisfies Messages<typeof en>;
