# Вспомогательные поля сериалайзера

#### SerializerMethodField

[Поле](https://github.com/encode/django-rest-framework/blob/0d5250cffada2ac250e24407953d4862d04d3dae/rest\_framework/fields.py#L1854) работает **только на чтение**.

Поле принимает на вход запись из БД целиком и возвращает результат каких-либо манипуляций с ней. Логику этих манипуляций описываем самостоятельно в отдельном методе.

Название метода должно состоять из двух элементов:

* из названия поля (именно оно будет возвращаться по запросу в качестве ключа)
* приставка `get_`.

Можно иначе назвать метод, но тогда потребуется передать это название в аргументе `method_name` при объявлении поля.

Пример

```python
class CapitalInfoSerializer(serializers.ModelSerializer):
    population_proportion = serializers.SerializerMethodField()
    
    class Meta:
        model = Capital
        fields = ['population_proportion']
        
    def get_population_proportion(self, obj):
        proportion = f'{obj.population / obj.country_population:.2%}'
        return proportion
```

Допустим, что есть таблица `Capital`, в которую записываются данные о столицах разных стран. Среди полей таблицы есть поле `population` для данных о численности столичного населения и поле `country_population` для данных о численности населения всей страны.

Поля `population_proportion` в модели нет, это поле сериалайзера и одновременно ключ в возвращаемой им паре "ключ-значение". Значение же вычисляется методом `get_population_proportion` c использованием данных из существующих полей модели.

Сериалайзер после обработки поступившей к нему записи из `Capital` вернет ее в формате `{"population_proportion":"15%"}`.

#### ReadOnlyField

[Поле](https://github.com/encode/django-rest-framework/blob/0d5250cffada2ac250e24407953d4862d04d3dae/rest\_framework/fields.py#L1811) работает **только на чтение** и просто возвращает значение, которое есть в соответствующем поле модели, без какого-либо преобразования со стороны сериалайзера.

#### HiddenField

[Поле](https://github.com/encode/django-rest-framework/blob/0d5250cffada2ac250e24407953d4862d04d3dae/rest\_framework/fields.py#L1832) работает **только на запись**. Принимает при создании только один аргумент `default`. Пара `{"название_поля":"дефолтное_значение"}` включается в `validated_data`.
